import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../../../lib/supabase';

/**
 * VehicleScanner component
 * Displays the device camera, decodes a QR code and lets the user choose whether
 * the scanned QR should be treated as a check-in or check-out action.
 *
 * Props
 *  - visible: boolean              -> whether the scanner modal is visible
 *  - onClose: () => void           -> called when user closes the modal
 *  - onScan: (data, action) => any -> called with the decoded QR text and the action ("checkin" | "checkout")
 */
const VehicleScanner = ({ visible, onClose, onScan }) => {
  const [scannedData, setScannedData] = useState(null);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef(null);
  const html5QrcodeScannerRef = useRef(null);

  // Reset stale state whenever visibility changes to prevent reusing old scans
  useEffect(() => {
    if (!visible) {
      setScannedData(null);
      setSessionDetails(null);
      setLoading(false);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && !scannedData && scannerRef.current) {
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false
      };

      const html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader",
        config,
        false
      );

      html5QrcodeScannerRef.current = html5QrcodeScanner;

      html5QrcodeScanner.render(
        (decodedText) => {
          console.log('QR Code detected:', decodedText);
          setScannedData(decodedText);
          fetchSessionDetails(decodedText);
          html5QrcodeScanner.clear();
        },
        (error) => {
          // Handle scan error, but don't log every frame
          if (error.includes('NotFoundException')) return;
          console.warn('QR scan error:', error);
        }
      );
    }

    return () => {
      if (html5QrcodeScannerRef.current) {
        html5QrcodeScannerRef.current.clear().catch(console.error);
      }
    };
  }, [visible, scannedData]);

  const fetchSessionDetails = async (qrData) => {
    setLoading(true);
    try {
      let sessionId;
      let sessionInfo;
      let spaceIdFromQr = null;
      let vehicleIdFromQr = null;

      // Try to parse as JSON first
      try {
        sessionInfo = JSON.parse(qrData);
        
        // Handle different possible JSON formats
        sessionId = sessionInfo.sid || sessionInfo.sessionId || sessionInfo.id || sessionInfo.session_id;
        spaceIdFromQr = sessionInfo.space_id || null;
        vehicleIdFromQr = sessionInfo.vehicle_id || null;
      } catch (jsonError) {
        // If not JSON, treat as plain session ID
        sessionId = qrData.trim();
      }

      // If neither sessionId nor spaceId present, treat as invalid
      if (!sessionId && !spaceIdFromQr) {
        throw new Error('No session or space ID found in QR code');
      }

      let session = null;
      let paymentsPromise = null;
      let cancelled = false;
      // guard to avoid setting state after unmount or new scan
      const cancelGuard = () => cancelled;

      // Simpler queries without unsupported joins (no public profiles table, vehicle FK not defined)
      const buildSessionQueryById = (id) =>
        supabase
          .from('parking_sessions')
          .select('id, user_id, vehicle_id, space_id, start_time, end_time, status')
          .eq('id', id)
          .single();

      const buildLatestSessionBySpace = (spaceId) =>
        supabase
          .from('parking_sessions')
          .select('id, user_id, vehicle_id, space_id, start_time, end_time, status')
          .eq('space_id', spaceId)
          .order('created_at', { ascending: false })
          .limit(1);

      let sessionResult;
      if (sessionId) {
        [sessionResult] = await Promise.all([
          buildSessionQueryById(sessionId),
          // in parallel, prep the latest payment if we have session id
          (paymentsPromise = supabase
            .from('payments')
            .select('status')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(1)),
        ]);
      } else if (spaceIdFromQr) {
        sessionResult = await buildLatestSessionBySpace(spaceIdFromQr);
      }

      if (cancelGuard()) return;

      if (sessionResult?.error) {
        console.error('Session fetch error:', sessionResult.error);
        // If we had sessionId, propagate error; otherwise allow space-only flow
        if (!spaceIdFromQr) {
          throw new Error(`Session fetch failed: ${sessionResult.error.message || sessionResult.error}`);
        }
      }

      if (!sessionResult?.data) {
        if (!spaceIdFromQr) {
          throw new Error(`No session found with ID: ${sessionId}`);
        }
      } else {
        session = Array.isArray(sessionResult.data) ? sessionResult.data[0] : sessionResult.data;
      }

      // Fetch vehicle data separately if available
      let vehicleData = null;
      if (session?.vehicle_id) {
        try {
          // Use RPC that bypasses RLS for admin scan context
          const { data: vehicleResult, error: vehicleErr } = await supabase
            .rpc('get_vehicle_for_admin', { vehicle_id: session.vehicle_id });
          if (!vehicleErr && Array.isArray(vehicleResult) && vehicleResult.length > 0) {
            vehicleData = {
              vehicle_model: vehicleResult[0].vehicle_model,
              vehicle_plate_number: vehicleResult[0].vehicle_plate_number,
            };
          }
        } catch {}
      }

      // Space data from joined result when available; otherwise fetch minimal fields
      const targetSpaceId = session?.space_id || spaceIdFromQr;
      let spaceData = null;
      if (targetSpaceId) {
        try {
          const { data: spaces } = await supabase
            .from('parking_spaces')
            .select('space_number, section, address, is_occupied')
            .eq('id', targetSpaceId)
            .single();
          spaceData = spaces || null;
        } catch {}
      }

      // If session is completed, do not allow actions
      if (session && session.status === 'completed') {
        alert('This session is already completed. Please scan a different QR.');
        setScannedData(null);
        setSessionDetails(null);
        return;
      }

      // Do not auto-checkout; present details and allow admin to choose action in UI

      const isCheckedIn = session ? session.status === 'checked_in' : false;

      // Resolve owner name using plural/singular profiles tables, then RPC fallback
      let ownerName = 'User';
      if (session?.user_id) {
        const uid = session.user_id;
        // 1) Try profiles (plural)
        try {
          const { data: prof1, error: e1 } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', uid)
            .single();
          if (!e1 && prof1) {
            ownerName = prof1.name || ownerName;
          }
        } catch {}

        // 2) Try profile (singular) if still generic
        if (ownerName === 'User') {
          try {
            const { data: prof2, error: e2 } = await supabase
              .from('profile')
              .select('name, email')
              .eq('id', uid)
              .single();
            if (!e2 && prof2) {
              ownerName = prof2.name || ownerName;
            }
          } catch {}
        }

        // 3) RPC fallback with SECURITY DEFINER
        if (ownerName === 'User') {
          try {
            const { data: rpcRows } = await supabase.rpc('get_profile_for_admin', {
              user_id: uid,
            });
            if (Array.isArray(rpcRows) && rpcRows.length > 0) {
              ownerName = rpcRows[0]?.name || ownerName;
            }
          } catch {}
        }

        // 4) Final fallback to short user id
        if (ownerName === 'User') {
          ownerName = uid ? `${String(uid).slice(0, 8)}…` : 'User';
        }
      }

      // Payment status from parallel promise if available
      let paymentStatus = 'pending';
      if (paymentsPromise) {
        try {
          const paymentsRes = await paymentsPromise;
          if (!paymentsRes.error && paymentsRes.data && paymentsRes.data.length > 0) {
            paymentStatus = paymentsRes.data[0].status;
          }
        } catch {}
      }

      if (!session) {
        throw new Error('Session not found');
      }

      try {
        const startDate = new Date(session.start_time);
        const endDate = new Date(session.end_time);
        const duration = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;

        const sessionDetailsObj = {
          session,
          ownerName,
          vehicleModel: vehicleData?.vehicle_model || 'Unknown Vehicle',
          vehiclePlate: vehicleData?.vehicle_plate_number || 'Unknown Plate',
          parkingSlot: spaceData ? `${spaceData.space_number} (${spaceData.section || spaceData.address})` : 'Unknown Space',
          duration,
          paymentStatus,
          isCheckedIn,
          isSpaceOccupied: !!spaceData?.is_occupied,
          spaceId: targetSpaceId || null,
          vehicleId: session?.vehicle_id || vehicleIdFromQr || null
        };

        setSessionDetails(sessionDetailsObj);
      } catch (dateError) {
        console.error('Error processing dates:', dateError);
        throw dateError;
      }

    } catch (error) {
      console.error('Error fetching session details:', error);
      alert(`Failed to load session: ${error?.message || 'Unknown error'}`);
      setScannedData(null);
      setSessionDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (html5QrcodeScannerRef.current) {
      html5QrcodeScannerRef.current.clear().catch(console.error);
    }
    setScannedData(null);
    setSessionDetails(null);
    onClose();
  };

  const handleRescan = () => {
    setScannedData(null);
    setSessionDetails(null);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <h3 className="text-lg font-medium text-white">Vehicle QR Scanner</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        {!scannedData ? (
          <div className="p-6 space-y-4">
            <div 
              id="qr-reader" 
              ref={scannerRef}
              className="w-full"
              style={{ minHeight: '300px' }}
            ></div>
            <p className="text-center text-sm text-gray-400">Point your camera at a QR code</p>
          </div>
        ) : loading ? (
          <div className="p-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
            <span className="ml-3 text-gray-400">Loading session details...</span>
          </div>
        ) : sessionDetails ? (
          <div className="p-6 space-y-6">
            {/* Session Details */}
            <div className="bg-gray-800 rounded-lg p-4 space-y-4">
              <h4 className="text-yellow-500 font-semibold text-lg mb-4">Booking Details</h4>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Owner Name</p>
                  <p className="text-white font-medium">{sessionDetails.ownerName}</p>
                </div>
                
                <div>
                  <p className="text-gray-400 text-sm">Vehicle Model</p>
                  <p className="text-white font-medium">{sessionDetails.vehicleModel}</p>
                </div>
                
                <div>
                  <p className="text-gray-400 text-sm">Vehicle Plate Number</p>
                  <p className="text-yellow-500 font-mono text-lg">{sessionDetails.vehiclePlate}</p>
                </div>
                
                <div>
                  <p className="text-gray-400 text-sm">Duration</p>
                  <p className="text-white font-medium">{sessionDetails.duration}</p>
                </div>
                
                <div>
                  <p className="text-gray-400 text-sm">Payment Status</p>
                  <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                    sessionDetails.paymentStatus === 'completed' ? 'bg-green-600 text-white' :
                    sessionDetails.paymentStatus === 'pending' ? 'bg-yellow-600 text-white' :
                    'bg-red-600 text-white'
                  }`}>
                    {sessionDetails.paymentStatus.charAt(0).toUpperCase() + sessionDetails.paymentStatus.slice(1)}
                  </span>
                </div>
                
                <div>
                  <p className="text-gray-400 text-sm">Parking Slot</p>
                  <p className="text-white font-medium">{sessionDetails.parkingSlot}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleRescan}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600"
              >
                Scan Again
              </button>
              <button
                onClick={async () => {
                  const action = sessionDetails?.isCheckedIn ? 'checkout' : 'checkin';
                  console.log('[VehicleScanner] Button clicked');
                  console.log('[VehicleScanner] Session status:', sessionDetails?.session?.status);
                  console.log('[VehicleScanner] isCheckedIn:', sessionDetails?.isCheckedIn);
                  console.log('[VehicleScanner] Determined action:', action);

                  try {
                    // Parse QR for session id
                    let info = null;
                    try { info = JSON.parse(scannedData); } catch {}
                    const sessionId = info?.sid || sessionDetails?.session?.id || null;
                    console.log('[VehicleScanner] Session ID:', sessionId);

                    const nowIso = new Date().toISOString();
                    if (sessionId) {
                      if (action === 'checkin') {
                        console.log('[VehicleScanner] Executing CHECK-IN');
                        // Set start_time to real check-in time
                        try {
                          await supabase.rpc('set_session_start_time_for_admin', {
                            session_id: sessionId,
                            start_ts: nowIso,
                          });
                        } catch (e) {
                          console.warn('Failed to set session start time:', e);
                        }
                      } else if (action === 'checkout') {
                        console.log('[VehicleScanner] Executing CHECK-OUT');
                        // Set end_time to real checkout time
                        try {
                          await supabase.rpc('set_session_end_time_for_admin', {
                            session_id: sessionId,
                            end_ts: nowIso,
                          });
                          console.log('[VehicleScanner] CHECK-OUT RPC completed');
                        } catch (e) {
                          console.warn('Failed to set session end time:', e);
                        }

                        // NOTE: Space deletion is handled by AdminDashboard.handleCheckOut
                        // after logging the activity with the space name
                      }
                    }
                  } finally {
                    console.log('[VehicleScanner] Calling onScan with action:', action);
                    onScan(scannedData, action);
                  }
                }}
                className={`px-6 py-2 rounded-md font-medium text-white ${sessionDetails?.isCheckedIn ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {sessionDetails?.isCheckedIn ? '↩️ Check-out Vehicle' : '✅ Check-in Vehicle'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="text-center text-red-400">
              <p>Failed to load session details</p>
              <button
                onClick={handleRescan}
                className="mt-2 px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600"
              >
                Scan Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleScanner;

