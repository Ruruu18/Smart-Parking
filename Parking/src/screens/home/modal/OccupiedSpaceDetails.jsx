import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

const OccupiedSpaceDetails = ({ visible, onClose, spaceId, onCheckoutSuccess }) => {
  const [loading, setLoading] = useState(true);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && spaceId) {
      fetchSessionDetails();
    }
  }, [visible, spaceId]);

  const fetchSessionDetails = async () => {
    try {
      setLoading(true);
      setError('');

      // First, try to fetch active checked-in session
      let { data: session, error: sessionError } = await supabase
        .from('parking_sessions')
        .select('*')
        .eq('space_id', spaceId)
        .eq('status', 'checked_in')
        .order('start_time', { ascending: false })
        .limit(1)
        .single();

      // If no checked-in session found, try to find the most recent session (any status)
      if (sessionError && sessionError.code === 'PGRST116') {
        const { data: anySession, error: anyError } = await supabase
          .from('parking_sessions')
          .select('*')
          .eq('space_id', spaceId)
          .order('start_time', { ascending: false })
          .limit(1)
          .single();

        if (!anyError && anySession) {
          session = anySession;
          // Mark this as a stale/inconsistent session
          session._isInconsistent = true;
        } else {
          setError('no_session_found');
          return;
        }
      } else if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        setError('no_session_found');
        return;
      }

      // Fetch user profile
      let userProfile = null;
      if (session.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('id', session.user_id)
          .single();
        userProfile = profile;
      }

      // Fetch vehicle details
      let vehicle = null;
      if (session.vehicle_id) {
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('plate, make, model, color')
          .eq('id', session.vehicle_id)
          .single();
        vehicle = vehicleData;
      }

      // Fetch parking space details
      let parkingSpace = null;
      if (session.space_id) {
        const { data: spaceData } = await supabase
          .from('parking_spaces')
          .select('space_number, section, address, daily_rate')
          .eq('id', session.space_id)
          .single();
        parkingSpace = spaceData;
      }

      // Combine all data
      const combinedData = {
        ...session,
        profiles: userProfile,
        vehicles: vehicle,
        parking_spaces: parkingSpace
      };

      setSessionDetails(combinedData);
    } catch (err) {
      console.error('Error fetching session details:', err);
      setError('Failed to load session details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!sessionDetails) return;

    const spaceName = sessionDetails.parking_spaces?.space_number || 'this space';

    const confirmCheckout = window.confirm(
      `Check out ${sessionDetails.profiles?.name || 'this vehicle'} and DELETE parking space ${spaceName}?\n\n⚠️ WARNING: This will:\n1. End the parking session\n2. PERMANENTLY DELETE the parking space\n\nThis action cannot be undone!`
    );

    if (!confirmCheckout) return;

    try {
      setCheckingOut(true);
      setError('');

      const nowIso = new Date().toISOString();

      // Call the RPC to set end time
      const { error: rpcError } = await supabase.rpc('set_session_end_time_for_admin', {
        session_id: sessionDetails.id,
        end_ts: nowIso,
      });

      if (rpcError) throw rpcError;

      // DELETE the parking space entirely
      const { error: deleteError } = await supabase
        .from('parking_spaces')
        .delete()
        .eq('id', spaceId);

      if (deleteError) throw deleteError;

      alert('✅ Vehicle checked out and parking space deleted successfully!');

      // Call success callback to refresh parking spaces
      if (onCheckoutSuccess) {
        onCheckoutSuccess();
      }

      onClose();
    } catch (err) {
      console.error('Error checking out and deleting space:', err);
      setError('Failed to check out vehicle and delete space. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleFixInconsistency = async () => {
    const confirmFix = window.confirm(
      'This parking space is marked as occupied but has no active session.\n\nMark this space as available?'
    );

    if (!confirmFix) return;

    try {
      setCheckingOut(true);

      // Update parking space to available
      const { error: spaceError } = await supabase
        .from('parking_spaces')
        .update({ is_occupied: false })
        .eq('id', spaceId);

      if (spaceError) throw spaceError;

      alert('✅ Parking space marked as available!');

      // Call success callback to refresh parking spaces
      if (onCheckoutSuccess) {
        onCheckoutSuccess();
      }

      onClose();
    } catch (err) {
      console.error('Error fixing inconsistency:', err);
      alert('❌ Failed to update parking space. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  };

  const calculateDuration = () => {
    if (!sessionDetails?.start_time) return 'N/A';
    const start = new Date(sessionDetails.start_time);
    const end = sessionDetails.end_time ? new Date(sessionDetails.end_time) : new Date();
    const diffMs = end - start;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''}, ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    }
    return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  };

  const calculateAmount = () => {
    if (!sessionDetails?.start_time || !sessionDetails?.parking_spaces?.daily_rate) return 0;
    const start = new Date(sessionDetails.start_time);
    const end = sessionDetails.end_time ? new Date(sessionDetails.end_time) : new Date();
    const diffMs = end - start;
    const diffDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    return Math.round(sessionDetails.parking_spaces.daily_rate * diffDays);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl bg-gray-800 shadow-2xl">
        {/* Header */}
        <div className="border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              {sessionDetails?.parking_spaces?.space_number || 'Occupied Space'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-yellow-400"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              {error === 'no_session_found' ? (
                <>
                  <div className="mb-4">
                    <svg className="h-16 w-16 text-yellow-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-yellow-400 font-semibold mb-2">Data Inconsistency Detected</p>
                    <p className="text-gray-300 text-sm mb-4">
                      This space is marked as occupied, but no active parking session was found.
                    </p>
                    <p className="text-gray-400 text-xs">
                      This can happen if a session was completed but the space status wasn't updated.
                    </p>
                  </div>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={fetchSessionDetails}
                      disabled={checkingOut}
                      className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 disabled:opacity-50"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={handleFixInconsistency}
                      disabled={checkingOut}
                      className="px-6 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 font-medium disabled:opacity-50 flex items-center"
                    >
                      {checkingOut ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Fixing...
                        </>
                      ) : (
                        '🔧 Mark as Available'
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-red-400 mb-4">{error}</p>
                  <button
                    onClick={fetchSessionDetails}
                    className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
                  >
                    Try Again
                  </button>
                </>
              )}
            </div>
          ) : sessionDetails ? (
            <div className="space-y-4">
              {/* User Info */}
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <svg className="h-5 w-5 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-gray-400 text-sm">Customer</span>
                </div>
                <p className="text-white font-semibold text-lg">{sessionDetails.profiles?.name || 'Unknown'}</p>
                {sessionDetails.profiles?.email && (
                  <p className="text-gray-400 text-sm">{sessionDetails.profiles.email}</p>
                )}
              </div>

              {/* Vehicle Info */}
              {sessionDetails.vehicles && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <svg className="h-5 w-5 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span className="text-gray-400 text-sm">Vehicle</span>
                  </div>
                  <p className="text-white font-bold text-lg">{sessionDetails.vehicles.plate}</p>
                  <p className="text-gray-300 text-sm">
                    {sessionDetails.vehicles.make} {sessionDetails.vehicles.model}
                    {sessionDetails.vehicles.color && ` • ${sessionDetails.vehicles.color}`}
                  </p>
                </div>
              )}

              {/* Session Details */}
              <div className="bg-gray-700/50 rounded-lg p-4 space-y-3">
                <div>
                  <div className="flex items-center mb-1">
                    <svg className="h-4 w-4 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-gray-400 text-sm">Check-in Time</span>
                  </div>
                  <p className="text-white ml-6">{formatDateTime(sessionDetails.start_time)}</p>
                </div>

                <div>
                  <div className="flex items-center mb-1">
                    <svg className="h-4 w-4 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-400 text-sm">Duration</span>
                  </div>
                  <p className="text-white ml-6">{calculateDuration()}</p>
                </div>

                <div>
                  <div className="flex items-center mb-1">
                    <svg className="h-4 w-4 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-400 text-sm">Amount Due</span>
                  </div>
                  <p className="text-yellow-400 font-bold text-xl ml-6">₱{calculateAmount()}</p>
                </div>

                {sessionDetails.parking_spaces?.section && (
                  <div>
                    <div className="flex items-center mb-1">
                      <svg className="h-4 w-4 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-gray-400 text-sm">Location</span>
                    </div>
                    <p className="text-white ml-6 text-sm">
                      {sessionDetails.parking_spaces.section}
                      {sessionDetails.parking_spaces.address && ` • ${sessionDetails.parking_spaces.address}`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        {!loading && !error && sessionDetails && (
          <div className="border-t border-gray-700 px-6 py-4 flex justify-between items-center">
            <button
              onClick={onClose}
              disabled={checkingOut}
              className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleCheckOut}
              disabled={checkingOut}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {checkingOut ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  🗑️ Check Out Space
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OccupiedSpaceDetails;
