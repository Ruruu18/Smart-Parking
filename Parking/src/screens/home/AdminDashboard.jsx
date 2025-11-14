// TIMESTAMP FIX APPLIED - v4.0 - Fixed database timestamp insertion & timezone handling
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import wheelLogo from "../../assets/images/icons/wheel.png";
import TotalSpace from "./modal/TotalSpace";
import OccupiedSpaceDetails from "./modal/OccupiedSpaceDetails";
import AddNewParking from "./quickActions/AddNewParking";
import VehicleScanner from "./quickActions/VehicleScanner";
import { redirectToCheckout } from "../../lib/paymongo";
import ViewReports from "./quickActions/ViewReports";
import ManageUsers from "./users/ManageUsers";
import VehicleManagement from "./quickActions/VehicleManagement";

// Shallow compare activity lists by id and time to avoid unnecessary UI updates
const sameActivities = (a = [], b = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.id !== b[i]?.id) return false;
    const at =
      a[i]?.time instanceof Date
        ? a[i].time.toISOString()
        : String(a[i]?.time || "");
    const bt =
      b[i]?.time instanceof Date
        ? b[i].time.toISOString()
        : String(b[i]?.time || "");
    if (at !== bt) return false;
  }
  return true;
};

// Helper function to add timeout to fetch operations
const withTimeout = (promise, timeoutMs = 8000, operationName = 'Operation') => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

const AdminDashboard = ({ onLogout }) => {
  const { user, userProfile } = useAuth();
  const lastActivityFetchRef = useRef(0);
  const isFetchingActivityRef = useRef(false);
  const realtimeDebounceRef = useRef(null);
  const [parkingSpaces, setParkingSpaces] = useState([]);
  const [stats, setStats] = useState({
    totalSpaces: 0,
    occupiedSpaces: 0,
    availableSpaces: 0,
    dailyRevenue: 0,
    totalEarnings: 0,
  });

  // Recent activity (user-facing: bookings and payments)
  const [recentActivity, setRecentActivity] = useState([]);
  // Hydrate cached recent payments on mount to avoid blink on remount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("admin_recent_payments");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentActivity(parsed);
        }
      }
    } catch {}
  }, []);
  // Persist recent payments whenever they change
  useEffect(() => {
    try {
      if (Array.isArray(recentActivity) && recentActivity.length > 0) {
        sessionStorage.setItem(
          "admin_recent_payments",
          JSON.stringify(recentActivity),
        );
      }
    } catch {}
  }, [recentActivity]);
  // Recent admin activities (admin actions only)
  const [recentAdminActivity, setRecentAdminActivity] = useState([]);
  // Recent user bookings (user activity separate from payments)
  const [recentUserActivity, setRecentUserActivity] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sessionStartTime, setSessionStartTime] = useState(null);

  // Modal visibility for adding space
  const [showAddSpaceModal, setShowAddSpaceModal] = useState(false);
  // Modal visibility for vehicle scanner
  const [showVehicleScanner, setShowVehicleScanner] = useState(false);

  // State for QR scanning modal
  const [showQRScanModal, setShowQRScanModal] = useState(false);
  const [scanType, setScanType] = useState("checkin"); // checkin or checkout
  const [scannedQR, setScannedQR] = useState("");
  const [selectedSpaceId, setSelectedSpaceId] = useState(null);
  const [bookingDetails, setBookingDetails] = useState(null);
  const [detailedBookingInfo, setDetailedBookingInfo] = useState(null);
  const [error, setError] = useState("");
  const [showAllActivitiesModal, setShowAllActivitiesModal] = useState(false); // user activities
  const [allActivities, setAllActivities] = useState([]); // user activities
  const [showAllAdminActivitiesModal, setShowAllAdminActivitiesModal] =
    useState(false);
  const [allAdminActivities, setAllAdminActivities] = useState([]);
  const [showAllUserActivitiesModal, setShowAllUserActivitiesModal] =
    useState(false);
  const [allUserActivities, setAllUserActivities] = useState([]);
  const [isVisible, setIsVisible] = useState(
    typeof document !== "undefined"
      ? document.visibilityState === "visible"
      : true,
  );

  // State for Total Space Modal
  const [showTotalSpace, setShowTotalSpace] = useState(false);

  // State for Manage Users Modal
  const [showManageUsers, setShowManageUsers] = useState(false);

  // State for Vehicle Management Modal
  const [showVehicleManagement, setShowVehicleManagement] = useState(false);

  // State for Occupied Space Details Modal
  const [showOccupiedDetails, setShowOccupiedDetails] = useState(false);
  const [selectedOccupiedSpace, setSelectedOccupiedSpace] = useState(null);

  // Helper function to safely parse JSON
  const tryParseJSON = (jsonString) => {
    try {
      // Check if the string looks like it might be JSON
      if (
        jsonString &&
        typeof jsonString === "string" &&
        jsonString.trim().startsWith("{")
      ) {
        return JSON.parse(jsonString);
      } else {
        return {}; // Return empty object for non-JSON strings
      }
    } catch (error) {
      console.error("Error parsing JSON:", error, "String:", jsonString);
      return {};
    }
  };

  // Format activity description from details field
  const formatActivityDescription = (action, detailsString) => {
    // If details is JSON with space info, format it nicely
    const parsed = tryParseJSON(detailsString);
    if (parsed && parsed.space_number) {
      const spaceDisplay = parsed.space_section
        ? `${parsed.space_number} (${parsed.space_section})`
        : parsed.space_number;

      if (action === 'booking_created') {
        return `New booking created for space ${spaceDisplay}`;
      }
    }

    // Otherwise, use the original details string or action
    return detailsString || action;
  };

  // Fetch detailed booking information with JOINs
  const fetchDetailedBookingInfo = async (sessionId, vehicleId, spaceId) => {
    try {
      setDetailedBookingInfo(null);

      // Fetch session details with user and vehicle information
      const { data: sessionData, error: sessionError } = await supabase
        .from("parking_sessions")
        .select(
          `
          *,
          profiles!parking_sessions_user_id_fkey (
            name
          ),
          vehicles!parking_sessions_vehicle_id_fkey (
            plate,
            make,
            model,
            color
          ),
          parking_spaces!parking_sessions_space_id_fkey (
            space_number,
            section,
            address,
            daily_rate
          )
        `,
        )
        .eq("id", sessionId)
        .single();

      if (sessionError) {
        console.error("Error fetching session details:", sessionError);

        // Fallback: try to get info by vehicle_id if session lookup fails
        if (vehicleId) {
          const { data: vehicleData, error: vehicleError } = await supabase
            .from("vehicles")
            .select(
              `
              *,
              profiles!vehicles_user_id_fkey (
                name
              )
            `,
            )
            .eq("id", vehicleId)
            .single();

          if (!vehicleError && vehicleData) {
            setDetailedBookingInfo({
              user_name: vehicleData.profiles?.name || "Unknown User",
              vehicle_plate: vehicleData.plate,
              vehicle_make: vehicleData.make,
              vehicle_model: vehicleData.model,
              vehicle_color: vehicleData.color,
              space_info: null,
              session_info: null,
            });
          }
        }
        return;
      }

      if (sessionData) {
        setDetailedBookingInfo({
          user_name: sessionData.profiles?.name || "Unknown User",
          vehicle_plate: sessionData.vehicles?.plate || "N/A",
          vehicle_make: sessionData.vehicles?.make || "N/A",
          vehicle_model: sessionData.vehicles?.model || "N/A",
          vehicle_color: sessionData.vehicles?.color || "N/A",
          space_number: sessionData.parking_spaces?.space_number || "N/A",
          space_section: sessionData.parking_spaces?.section || "N/A",
          space_address: sessionData.parking_spaces?.address || "N/A",
          daily_rate: sessionData.parking_spaces?.daily_rate || 0,
          start_time: sessionData.start_time,
          end_time: sessionData.end_time,
          status: sessionData.status,
          total_amount: sessionData.total_amount,
          session_info: sessionData,
        });
      }
    } catch (error) {
      console.error("Error fetching detailed booking info:", error);
    }
  };

  // Fetch parking spaces from Supabase
  const fetchParkingSpaces = async () => {
    try {
      const fetchPromise = supabase
        .from("parking_spaces")
        .select("*")
        .order("created_at", { ascending: false });

      const { data, error } = await withTimeout(fetchPromise, 8000, 'Fetch parking spaces');

      if (error) throw error;

      if (data) {
        setParkingSpaces(data);

        // Calculate stats
        const occupied = data.filter((space) => space.is_occupied).length;
        const total = data.length;

        // Preserve revenue-related stats to avoid blinking while other fetches update them
        setStats((prev) => ({
          ...prev,
          totalSpaces: total,
          occupiedSpaces: occupied,
          availableSpaces: total - occupied,
        }));

        // Also refresh today's revenue from completed payments
        fetchTodayRevenue();
        fetchTotalEarnings();
      }
    } catch (error) {
      console.error("Error fetching parking spaces:", error);
      // Set empty state on error to prevent infinite loading
      if (parkingSpaces.length === 0) {
        setParkingSpaces([]);
      }
    }
  };

  // Sum of completed payments created today (local day)
  // ONLY includes payments for sessions with active parking spaces (space_id NOT NULL)
  const fetchTodayRevenue = async () => {
    try {
      // Create date range for today in local timezone
      const now = new Date();
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0,
      );
      const end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      );

      // Count all payments for today, including those for deleted spaces
      // Changed from inner join to left join so payments persist even after space deletion
      const fetchPromise = supabase
        .from("payments")
        .select("amount, status, created_at")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .eq("status", "completed");

      const { data, error } = await withTimeout(fetchPromise, 8000, 'Fetch today revenue');

      if (error) throw error;

      const sum = (data || []).reduce(
        (acc, p) => acc + (parseFloat(p.amount ?? 0) || 0),
        0,
      );
      const next = Math.round(sum);
      setStats((s) =>
        s.dailyRevenue === next ? s : { ...s, dailyRevenue: next },
      );
    } catch (e) {
      console.error("Error fetching daily revenue:", e);
      // Set to 0 on error to prevent showing stale data
      setStats((s) => ({ ...s, dailyRevenue: 0 }));
    }
  };

  // Sum of all completed payments (all-time)
  // Includes ALL payments, even for deleted spaces - payments persist forever
  const fetchTotalEarnings = async () => {
    try {
      // Count all completed payments regardless of space deletion status
      // Payments should persist and be reflected in earnings even after space is deleted
      const fetchPromise = supabase
        .from("payments")
        .select("amount")
        .eq("status", "completed");

      const { data, error } = await withTimeout(fetchPromise, 30000, 'Fetch total earnings');

      if (error) throw error;

      const sum = (data || []).reduce(
        (acc, p) => acc + (parseFloat(p.amount ?? 0) || 0),
        0,
      );
      const next = Math.round(sum);
      setStats((s) =>
        s.totalEarnings === next ? s : { ...s, totalEarnings: next },
      );
    } catch (e) {
      console.error("Error fetching total earnings:", e);
      // Keep previous value on error
    }
  };

  // Fetch recent activity
  const fetchRecentActivity = async () => {
    // Throttle duplicate calls within 1.5s to prevent flicker
    const nowTs = Date.now();
    if (
      nowTs - lastActivityFetchRef.current < 1500 ||
      isFetchingActivityRef.current
    ) {
      return;
    }
    isFetchingActivityRef.current = true;

    // Add timeout to reset fetching flag if operation hangs
    const resetTimeout = setTimeout(() => {
      if (isFetchingActivityRef.current) {
        console.warn('fetchRecentActivity timed out, resetting flag');
        isFetchingActivityRef.current = false;
      }
    }, 12000); // 12 second timeout for all operations

    // Prevent fetching if user is not logged in or not admin
    if (!user || !userProfile || userProfile.role !== "admin") {
      setRecentActivity([]);
      setAllActivities([]);
      clearTimeout(resetTimeout);
      isFetchingActivityRef.current = false;
      return;
    }

    try {
      // Fetch recent USER activities from new table (bookings/parking/views etc.)
      const userActivitiesPromise = supabase
        .from("user_activities")
        .select(
          `
          id,
          type,
          action,
          details,
          created_at
        `,
        )
        .order("created_at", { ascending: false })
        .limit(25);

      const { data: userActivitiesRows, error: userActivitiesError } =
        await withTimeout(userActivitiesPromise, 8000, 'Fetch user activities');

      if (userActivitiesError) throw userActivitiesError;

      // Fetch recent payments - show ALL recent payments
      const paymentsPromise = supabase
        .from("payments")
        .select(
          `
          id,
          amount,
          payment_method,
          status,
          created_at
        `,
        )
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: payments, error: paymentsError } =
        await withTimeout(paymentsPromise, 8000, 'Fetch payments');

      if (paymentsError) throw paymentsError;

      // Fetch recent admin activities - admin actions only
      let adminActivities = [];
      try {
        const { data, error } = await supabase
          .from("admin_activities")
          .select(
            `
            id,
            action,
            details,
            created_at
          `,
          )
          .order("created_at", { ascending: false })
          .limit(25); // Increased limit since this is now our primary activity source

        if (error) {
          console.error("Error fetching admin activities:", error);
        } else {
          adminActivities = data;
        }
      } catch (error) {
        console.error("Error fetching admin activities:", error);
      }

      // Format user activities
      const formattedUserActivities = (userActivitiesRows || []).map((row) => {
        const base = {
          id: row.id,
          time: row.created_at,
          details: {},
        };
        if (row.type === "booking") {
          return {
            ...base,
            type: "booking",
            description: formatActivityDescription(row.action, row.details) || "New booking",
          };
        }
        if (row.type === "payment") {
          return {
            ...base,
            type: "payment",
            description: row.details || "Payment event",
          };
        }
        if (row.type === "parking") {
          return {
            ...base,
            type: "parking",
            description:
              row.details ||
              (row.action === "check_in" ? "Checked in" : "Checked out"),
          };
        }
        return {
          ...base,
          type: "user",
          description: row.details || row.action,
        };
      });

      // Format payments (user activity) - Simple fix for timezone
      const formattedPayments =
        payments?.map((payment) => ({
          type: "payment",
          // Use Philippine Peso symbol (₱)
          description: `Payment of ₱${payment.amount}`,
          time: payment.created_at, // use actual payment timestamp so time-ago is accurate
          details: {
            method: payment.payment_method,
            status: payment.status,
          },
          id: payment.id, // Add id for use as key in rendering
        })) || [];

      // Format admin activities (admin log)
      const formattedAdminActivities =
        adminActivities?.map((activity) => {
          // Determine activity type and icon based on action
          let activityType = "admin";
          if (activity.action === "customer_booking") {
            activityType = "booking";
          } else if (
            activity.action === "check_in" ||
            activity.action === "check_out"
          ) {
            activityType = "parking";
          }

          return {
            type: activityType,
            description: formatActivityDescription(activity.action, activity.details),
            time: activity.created_at,
            details: activity.details ? tryParseJSON(activity.details) : {},
            id: activity.id, // Add id for use as key in rendering
          };
        }) || [];

      // Payments list ONLY for the top-right panel (Recent Payments)
      const paymentsOnly = [...formattedPayments].sort(
        (a, b) => new Date(b.time) - new Date(a.time),
      );

      // Prioritize current session window if set
      let paymentsDisplay = paymentsOnly;
      if (sessionStartTime) {
        const withinSession = paymentsOnly.filter(
          (a) => new Date(a.time) >= new Date(sessionStartTime),
        );
        const others = paymentsOnly.filter(
          (a) => new Date(a.time) < new Date(sessionStartTime),
        );
        paymentsDisplay = [...withinSession, ...others];
      }

      const topPayments = paymentsDisplay.slice(0, 4);
      setAllActivities((prev) =>
        sameActivities(prev, paymentsOnly) ? prev : paymentsOnly,
      );
      setRecentActivity((prev) =>
        sameActivities(prev, topPayments) ? prev : topPayments,
      );

      // User bookings list for the side panel (Recent User Activity)
      const bookingsOnly = [
        ...formattedUserActivities.filter((a) => a.type === "booking"),
      ].sort((a, b) => new Date(b.time) - new Date(a.time));
      let bookingsDisplay = bookingsOnly;
      if (sessionStartTime) {
        const withinSession = bookingsOnly.filter(
          (a) => new Date(a.time) >= new Date(sessionStartTime),
        );
        const others = bookingsOnly.filter(
          (a) => new Date(a.time) < new Date(sessionStartTime),
        );
        bookingsDisplay = [...withinSession, ...others];
      }
      const topBookings = bookingsDisplay.slice(0, 4);
      setAllUserActivities((prev) =>
        sameActivities(prev, bookingsOnly) ? prev : bookingsOnly,
      );
      setRecentUserActivity((prev) =>
        sameActivities(prev, topBookings) ? prev : topBookings,
      );

      // Admin activities list
      const sortedAdmin = formattedAdminActivities.sort(
        (a, b) => new Date(b.time) - new Date(a.time),
      );
      setAllAdminActivities((prev) =>
        sameActivities(prev, sortedAdmin) ? prev : sortedAdmin,
      );
      let adminDisplay = sortedAdmin;
      if (sessionStartTime) {
        const withinSession = sortedAdmin.filter(
          (a) => new Date(a.time) >= new Date(sessionStartTime),
        );
        const others = sortedAdmin.filter(
          (a) => new Date(a.time) < new Date(sessionStartTime),
        );
        adminDisplay = [...withinSession, ...others];
      }
      const topAdmin = adminDisplay.slice(0, 4);
      setRecentAdminActivity((prev) =>
        sameActivities(prev, topAdmin) ? prev : topAdmin,
      );
      lastActivityFetchRef.current = Date.now();
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      // Set empty arrays on error to prevent infinite loading
      setRecentActivity([]);
      setAllActivities([]);
    } finally {
      clearTimeout(resetTimeout);
      isFetchingActivityRef.current = false;
    }
  };

  // Helper function to format time ago
  const getTimeAgo = (timestamp) => {
    try {
      if (!timestamp) return "Invalid date";

      let activityTime;

      if (timestamp instanceof Date) {
        activityTime = timestamp;
      } else {
        // Simple approach: just parse the timestamp normally
        activityTime = new Date(timestamp);
      }

      if (isNaN(activityTime)) return "Invalid date";

      const now = new Date();

      // For payment timestamps showing "8h ago", force correct calculation
      // Check if this looks like a recent payment (within last 24 hours in Philippine time)
      const timeDiff = now - activityTime;
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      // If it's showing as 8+ hours ago but the timestamp suggests it's recent, adjust it
      if (hoursDiff >= 7 && hoursDiff <= 9) {
        // This is likely the timezone issue - subtract 8 hours from the difference
        const correctedTime = new Date(
          activityTime.getTime() + 8 * 60 * 60 * 1000,
        );
        const correctedDiff = now - correctedTime;
        const diffSeconds = Math.max(0, Math.round(correctedDiff / 1000));

        if (diffSeconds < 5) return "just now";
        if (diffSeconds < 60) return `${diffSeconds}s ago`;
        if (diffSeconds < 3600) return `${Math.round(diffSeconds / 60)}m ago`;
        if (diffSeconds < 86400)
          return `${Math.round(diffSeconds / 3600)}h ago`;
      }

      // Normal calculation for other timestamps
      const diffSeconds = Math.max(0, Math.round(timeDiff / 1000));

      if (diffSeconds < 5) return "just now";
      if (diffSeconds < 60) return `${diffSeconds}s ago`;
      if (diffSeconds < 3600) return `${Math.round(diffSeconds / 60)}m ago`;
      if (diffSeconds < 86400) return `${Math.round(diffSeconds / 3600)}h ago`;

      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(activityTime);
    } catch (error) {
      console.error("Error parsing timestamp:", timestamp, error);
      return "Invalid date";
    }
  };

  // Function to handle check-in
  const handleCheckIn = async (spaceId, qrCode) => {
    try {
      // Parse QR code to get session and vehicle info
      let sessionId = null;
      let vehicleId = null;

      try {
        const qrData = JSON.parse(qrCode);
        sessionId =
          qrData.sid || qrData.sessionId || qrData.id || qrData.session_id;
        vehicleId = qrData.vehicle_id || null;
      } catch (parseError) {
        console.log(
          "QR code is not JSON format, proceeding without session/vehicle info",
        );
      }

      // 1. Update parking space to occupied
      const { error: spaceError } = await supabase
        .from("parking_spaces")
        .update({
          is_occupied: true,
          occupied_since: new Date().toISOString(),
          vehicle_id: vehicleId, // Now properly UUID type
        })
        .eq("id", spaceId);

      if (spaceError) throw spaceError;

      // 2. Update parking session status to checked_in (if session ID available)
      if (sessionId) {
        console.log("Updating session status for sessionId:", sessionId);

        try {
          const { data: sessionUpdated, error: sessionError } =
            await supabase.rpc("update_session_status_for_admin", {
              session_id: sessionId,
              new_status: "checked_in",
            });

          console.log("Session update result:", {
            sessionUpdated,
            sessionError,
          });

          if (sessionError) {
            console.warn("Could not update session status:", sessionError);
            // Don't throw error, space update was successful
          } else if (sessionUpdated) {
            console.log("Session status successfully updated to checked_in");
          } else {
            console.warn("Session not found or update failed");
          }
        } catch (rpcError) {
          console.warn("RPC call failed for session update:", rpcError);
        }
      } else {
        console.warn(
          "No session ID found in QR code, skipping session status update",
        );
      }

      // 3. Get vehicle type and space info for cleaner activity log
      let vehicleType = "vehicle";
      let spaceNumber = "unknown space";

      // Get vehicle type
      if (vehicleId) {
        try {
          const { data: vehicleResult } = await supabase.rpc(
            "get_vehicle_for_admin",
            { vehicle_id: vehicleId },
          );

          if (vehicleResult && vehicleResult.length > 0) {
            vehicleType = vehicleResult[0].vehicle_type || "vehicle";
          }
        } catch (error) {
          console.warn("Could not fetch vehicle details for activity log");
        }
      }

      // Get space number
      try {
        const { data: spaceDetails } = await supabase
          .from("parking_spaces")
          .select("space_number, section")
          .eq("id", spaceId)
          .single();

        if (spaceDetails) {
          spaceNumber = `${spaceDetails.space_number}`;
        }
      } catch (error) {
        console.warn("Could not fetch space details for activity log");
      }

      // 4. Log admin activity with clean message (capitalize vehicle type)
      const capitalizedVehicleType =
        vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1);
      await logAdminActivity(
        "check_in",
        `Checked in ${capitalizedVehicleType} ${spaceNumber}`,
      );

      // Refresh parking spaces
      fetchParkingSpaces();
      fetchRecentActivity();
      return true;
    } catch (error) {
      console.error("Error during check-in:", error);
      setError("Failed to check in vehicle. Please try again.");
      return false;
    }
  };

  // Function to handle check-out
  const handleCheckOut = async (spaceId, qrCode) => {
    try {
      // Parse QR code to get session info
      let sessionId = null;

      try {
        const qrData = JSON.parse(qrCode);
        sessionId =
          qrData.sid || qrData.sessionId || qrData.id || qrData.session_id;
      } catch (parseError) {
        console.log(
          "QR code is not JSON format, proceeding without session info",
        );
      }

      // 1. Update parking space to unoccupied
      const { error: spaceError } = await supabase
        .from("parking_spaces")
        .update({
          is_occupied: false,
          vehicle_id: null,
          occupied_since: null,
        })
        .eq("id", spaceId);

      if (spaceError) throw spaceError;

      // 2. Update parking session status to completed (if session ID available)
      if (sessionId) {
        try {
          const { data: sessionUpdated, error: sessionError } =
            await supabase.rpc("update_session_status_for_admin", {
              session_id: sessionId,
              new_status: "completed",
            });

          if (sessionError) {
            console.warn("Could not update session status:", sessionError);
            // Don't throw error, space update was successful
          } else if (sessionUpdated) {
            console.log("Session status successfully updated to completed");
          } else {
            console.warn("Session not found or update failed");
          }
        } catch (rpcError) {
          console.warn("RPC call failed for session update:", rpcError);
        }
      }

      // 3. Get vehicle type and space info for cleaner activity log
      let vehicleType = "vehicle";
      let spaceNumber = "unknown space";
      let vehicleIdForLog = null;

      // Try to get vehicle_id from QR code first
      try {
        const qrData = JSON.parse(qrCode);
        vehicleIdForLog = qrData.vehicle_id;
      } catch (parseError) {
        console.log("Could not parse QR code for vehicle info");
      }

      // If no vehicle_id in QR, try to get it from the space that's being checked out
      if (!vehicleIdForLog) {
        try {
          const { data: spaceDetails } = await supabase
            .from("parking_spaces")
            .select("vehicle_id")
            .eq("id", spaceId)
            .single();

          vehicleIdForLog = spaceDetails?.vehicle_id;
        } catch (error) {
          console.warn("Could not fetch vehicle_id from space");
        }
      }

      // Get vehicle type
      if (vehicleIdForLog) {
        try {
          const { data: vehicleResult } = await supabase.rpc(
            "get_vehicle_for_admin",
            { vehicle_id: vehicleIdForLog },
          );

          if (vehicleResult && vehicleResult.length > 0) {
            vehicleType = vehicleResult[0].vehicle_type || "vehicle";
          }
        } catch (error) {
          console.warn("Could not fetch vehicle details for activity log");
        }
      }

      // Get space number
      try {
        const { data: spaceDetails } = await supabase
          .from("parking_spaces")
          .select("space_number, section")
          .eq("id", spaceId)
          .single();

        if (spaceDetails) {
          spaceNumber = `${spaceDetails.space_number}`;
        }
      } catch (error) {
        console.warn("Could not fetch space details for activity log");
      }

      // 4. Log admin activity with clean message (capitalize vehicle type)
      const capitalizedVehicleType =
        vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1);
      await logAdminActivity(
        "check_out",
        `Checked out ${capitalizedVehicleType} ${spaceNumber}`,
      );

      // 5. Set space_id to NULL in ALL sessions for this space to preserve history
      // IMPORTANT: This preserves booking, check-in, check-out, and PAYMENT records
      // by unlinking sessions from the space before deletion. This prevents CASCADE deletion
      // of sessions (and their associated payments) when the parking space is deleted.
      // The database also has ON DELETE SET NULL constraint as a safeguard.
      try {
        // First, unlink ALL sessions from this space (not just completed ones)
        const { data: sessions, error: findError } = await supabase
          .from('parking_sessions')
          .select('id')
          .eq('space_id', spaceId);

        if (findError) {
          console.error('Error finding sessions for space:', findError);
        }

        console.log(`Found ${sessions?.length || 0} sessions linked to space ${spaceId}`);

        if (sessions && sessions.length > 0) {
          const { error: updateError } = await supabase
            .from('parking_sessions')
            .update({ space_id: null })
            .in('id', sessions.map(s => s.id));

          if (updateError) {
            console.error('Error unlinking sessions from space:', updateError);
            throw updateError; // Don't delete space if we can't unlink sessions
          }

          console.log(`Successfully unlinked ${sessions.length} sessions from space`);
        }

        // BEFORE deleting space: Update user_activities to preserve space info in details JSON
        // This ensures booking reports will show space number even after deletion
        const { data: spaceData, error: spaceFetchError } = await supabase
          .from('parking_spaces')
          .select('space_number, section')
          .eq('id', spaceId)
          .single();

        console.log('[QR Checkout] Space fetch result:', { spaceData, spaceFetchError });

        if (!spaceFetchError && spaceData?.space_number) {
          console.log(`[QR Checkout] Preserving space info: ${spaceData.space_number} (${spaceData.section || 'no section'})`);

          // STEP 1: Get all session IDs for this space
          const sessionIds = sessions ? sessions.map(s => s.id) : [];
          console.log('[QR Checkout] Session IDs for this space:', sessionIds);

          // STEP 2: Find ALL user_activities for this space
          // Query by BOTH space_id AND session_id to catch booking activities
          let allActivities = [];

          // Query 1: Activities with space_id
          const { data: spaceActivities, error: spaceActivitiesError } = await supabase
            .from('user_activities')
            .select('id, details, type, space_id, session_id')
            .eq('space_id', spaceId);

          if (spaceActivities) {
            allActivities = [...spaceActivities];
          }

          // Query 2: Activities with session_id (this catches booking activities!)
          if (sessionIds.length > 0) {
            const { data: sessionActivities, error: sessionActivitiesError } = await supabase
              .from('user_activities')
              .select('id, details, type, space_id, session_id')
              .in('session_id', sessionIds);

            if (sessionActivities) {
              // Merge, avoiding duplicates
              const existingIds = new Set(allActivities.map(a => a.id));
              const newActivities = sessionActivities.filter(a => !existingIds.has(a.id));
              allActivities = [...allActivities, ...newActivities];
            }
          }

          const activities = allActivities;
          const activitiesError = spaceActivitiesError;

          console.log('[QR Checkout] Activities query result:', {
            found: activities?.length || 0,
            fromSpace: spaceActivities?.length || 0,
            fromSessions: sessionIds.length,
            total: activities.length,
            activities: activities
          });

          if (activitiesError) {
            console.error('[QR Checkout] Error fetching activities:', activitiesError);
          }

          if (!activitiesError && activities && activities.length > 0) {
            console.log(`[QR Checkout] Updating ${activities.length} activities with space information`);

            // Update each activity's details to include space info
            for (const activity of activities) {
              console.log(`[QR Checkout] Processing activity ${activity.id}, type: ${activity.type}`);

              let details = {};
              let isValidJSON = false;
              try {
                const parsed = activity.details ? JSON.parse(activity.details) : {};
                if (typeof parsed === 'object' && parsed !== null) {
                  details = parsed;
                  isValidJSON = true;
                }
              } catch (e) {
                console.warn(`[QR Checkout] Details is not JSON for activity ${activity.id}, will create new object`);
                details = {};
                isValidJSON = false;
              }

              // Check if space_number already has a valid value
              const hasSpaceNumber = details.space_number && details.space_number !== '';

              if (!hasSpaceNumber) {
                // Add/update space info (preserve all existing fields)
                const updatedDetails = {
                  ...details,
                  space_number: spaceData.space_number,
                  space_section: spaceData.section || '',
                };

                console.log(`[QR Checkout] Updating activity ${activity.id} - adding space info (had ${Object.keys(details).length} fields, now ${Object.keys(updatedDetails).length} fields)`);

                const { error: updateError } = await supabase
                  .from('user_activities')
                  .update({ details: JSON.stringify(updatedDetails) })
                  .eq('id', activity.id);

                if (updateError) {
                  console.error(`[QR Checkout] ❌ Failed to update activity ${activity.id}:`, updateError);
                } else {
                  console.log(`[QR Checkout] ✅ Successfully saved space info for activity ${activity.id}: ${spaceData.space_number}`);
                }
              } else {
                console.log(`[QR Checkout] ⏭️ Skipping activity ${activity.id} - already has space_number: ${details.space_number}`);
              }
            }

            console.log(`[QR Checkout] ✅ Successfully preserved space info in ${activities.length} activities`);
          } else {
            console.warn('[QR Checkout] ⚠️ No activities found for space_id:', spaceId);
          }
        } else {
          console.error('[QR Checkout] ❌ Failed to fetch space data or no space_number:', { spaceFetchError, spaceData });
        }

        // Then delete the parking space (only after preserving data and unlinking sessions)
        // Since sessions are preserved and activities have space info, all history is preserved
        const { error: deleteError } = await supabase
          .from('parking_spaces')
          .delete()
          .eq('id', spaceId);

        if (deleteError) {
          console.error('Error deleting parking space:', deleteError);
          throw deleteError;
        }

        console.log(`Successfully deleted parking space ${spaceId}`);
      } catch (deleteError) {
        console.error('Failed to delete parking space:', deleteError);
        // Don't throw - allow the checkout to complete even if deletion fails
      }

      // Refresh parking spaces
      fetchParkingSpaces();
      fetchRecentActivity();
      return true;
    } catch (error) {
      console.error("Error during check-out:", error);
      setError("Failed to check out vehicle. Please try again.");
      return false;
    }
  };

  // Function to log admin activity
  const logAdminActivity = async (action, details, metadata = {}) => {
    try {
      // Only include metadata in details if it has meaningful content
      let fullDetails = details;
      if (metadata && Object.keys(metadata).length > 0) {
        fullDetails = `${details} - ${JSON.stringify(metadata)}`;
      }

      const { data, error } = await supabase.from("admin_activities").insert([
        {
          admin_id: user?.id || null, // Required field
          action: action,
          details: fullDetails,
          // created_at has default value, don't set it explicitly
        },
      ]);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error logging admin activity:", error);
      return null;
    }
  };

  // Handle QR scan submission
  const handleQRScanSubmit = async (e) => {
    e.preventDefault();
    if (!scannedQR || !selectedSpaceId) {
      setError("Please enter a QR code and select a parking space.");
      return;
    }

    let success;
    if (scanType === "checkin") {
      success = await handleCheckIn(selectedSpaceId, scannedQR);
    } else {
      success = await handleCheckOut(selectedSpaceId, scannedQR);
    }

    if (success) {
      setShowQRScanModal(false);
      setScannedQR("");
      setSelectedSpaceId(null);
      setBookingDetails(null);
    }
  };

  // Open QR scan modal for check-in
  const openCheckInScan = (spaceId) => {
    setScanType("checkin");
    setSelectedSpaceId(spaceId);
    setShowQRScanModal(true);
    setError("");
  };

  // Open QR scan modal for check-out
  const openCheckOutScan = (spaceId) => {
    setScanType("checkout");
    setSelectedSpaceId(spaceId);
    setShowQRScanModal(true);
    setError("");
  };

  // Effect for initial data fetch and cleanup
  useEffect(() => {
    if (user && userProfile && userProfile.role === "admin") {
      // Set session start time when admin logs in
      const currentLoginTime = new Date().toISOString();
      setSessionStartTime(currentLoginTime);
      fetchParkingSpaces();
      fetchRecentActivity();
      fetchTotalEarnings();
    } else {
      // Clear recent activity if user is not logged in or not admin
      setRecentActivity([]);
      setAllActivities([]);
      setSessionStartTime(null); // Reset session time on logout
    }

    // Cleanup function to clear recent activity when component unmounts (which can happen on logout)
    return () => {
      setRecentActivity([]);
      setAllActivities([]);
      setSessionStartTime(null);
    };
  }, [user, userProfile]);

  // Page visibility handling to avoid burst updates when returning to tab
  useEffect(() => {
    const handler = () => {
      const visible = document.visibilityState === "visible";
      setIsVisible(visible);
      if (visible && user && userProfile && userProfile.role === "admin") {
        // Refresh once when back to the tab
        fetchParkingSpaces();
        fetchRecentActivity();
        fetchTodayRevenue();
        fetchTotalEarnings();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [user, userProfile]);

  // Additional useEffect to immediately clear activities when user logs out
  useEffect(() => {
    if (!user || !userProfile || userProfile.role !== "admin") {
      setRecentActivity([]);
      setAllActivities([]);
    }
  }, [user, userProfile]);

  // Fetch activity when session start time is set
  useEffect(() => {
    if (
      sessionStartTime &&
      user &&
      userProfile &&
      userProfile.role === "admin"
    ) {
      fetchRecentActivity();
    }
  }, [sessionStartTime]);

  useEffect(() => {
    // Only set up intervals and subscriptions if user is logged in and is admin
    if (!user || !userProfile || userProfile.role !== "admin" || !isVisible) {
      return;
    }

    // Set up interval for clock (update once per minute to reduce rerenders)
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    // Set up interval for refreshing data (every 30 seconds)
    const dataRefreshTimer = setInterval(() => {
      // Double-check user is still admin before fetching
      if (
        user &&
        userProfile &&
        userProfile.role === "admin" &&
        sessionStartTime
      ) {
        fetchParkingSpaces();
        fetchRecentActivity();
        fetchTotalEarnings();
      }
    }, 30000);

    // Subscribe to parking spaces and sessions changes
    const channel = supabase
      .channel("public:parking_spaces_and_sessions")
      // ---- parking_spaces realtime ----
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "parking_spaces" },
        (payload) => {
          if (user && userProfile && userProfile.role === "admin") {
            const newSpace = payload.new;
            setParkingSpaces((prev) => {
              const next = [newSpace, ...prev];
              const occupied = next.filter((s) => s.is_occupied).length;
              const total = next.length;
              setStats((prevStats) => ({
                ...prevStats,
                totalSpaces: total,
                occupiedSpaces: occupied,
                availableSpaces: total - occupied,
              }));
              return next;
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "parking_spaces" },
        (payload) => {
          if (user && userProfile && userProfile.role === "admin") {
            const updated = payload.new;
            setParkingSpaces((prev) => {
              const next = prev.map((s) => (s.id === updated.id ? updated : s));
              const occupied = next.filter((s) => s.is_occupied).length;
              const total = next.length;
              setStats((prevStats) => ({
                ...prevStats,
                totalSpaces: total,
                occupiedSpaces: occupied,
                availableSpaces: total - occupied,
              }));
              return next;
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "parking_spaces" },
        (payload) => {
          if (user && userProfile && userProfile.role === "admin") {
            const removedId = payload.old.id;
            setParkingSpaces((prev) => {
              const next = prev.filter((s) => s.id !== removedId);
              const occupied = next.filter((s) => s.is_occupied).length;
              const total = next.length;
              setStats((prevStats) => ({
                ...prevStats,
                totalSpaces: total,
                occupiedSpaces: occupied,
                availableSpaces: total - occupied,
              }));
              return next;
            });
          }
        },
      )
      // ---- parking_sessions realtime (bookings) ----
      .on(
        "postgres_changes",
        { schema: "public", table: "parking_sessions", event: "INSERT" },
        (payload) => {
          // Update stats and recent activity when a user books a space
          if (
            user &&
            userProfile &&
            userProfile.role === "admin" &&
            sessionStartTime
          ) {
            if (realtimeDebounceRef.current)
              clearTimeout(realtimeDebounceRef.current);
            realtimeDebounceRef.current = setTimeout(() => {
              fetchParkingSpaces();
              fetchRecentActivity();
            }, 600);
          }
        },
      )
      .on(
        "postgres_changes",
        { schema: "public", table: "parking_sessions", event: "UPDATE" },
        (payload) => {
          if (
            user &&
            userProfile &&
            userProfile.role === "admin" &&
            sessionStartTime
          ) {
            if (realtimeDebounceRef.current)
              clearTimeout(realtimeDebounceRef.current);
            realtimeDebounceRef.current = setTimeout(() => {
              fetchParkingSpaces();
              fetchRecentActivity();
              fetchTodayRevenue();
            }, 600);
          }
        },
      )
      // payments realtime to update daily revenue as they complete
      .on(
        "postgres_changes",
        { schema: "public", table: "payments", event: "*" },
        (payload) => {
          if (
            user &&
            userProfile &&
            userProfile.role === "admin" &&
            sessionStartTime
          ) {
            if (realtimeDebounceRef.current)
              clearTimeout(realtimeDebounceRef.current);
            // Add a small delay to ensure the data is committed and batch multiple events
            realtimeDebounceRef.current = setTimeout(() => {
              fetchTodayRevenue();
              fetchRecentActivity();
              fetchTotalEarnings();
            }, 800);
          }
        },
      )
      // ---- admin_activities realtime ----
      .on(
        "postgres_changes",
        { schema: "public", table: "admin_activities", event: "*" },
        (payload) => {
          if (
            user &&
            userProfile &&
            userProfile.role === "admin" &&
            sessionStartTime
          ) {
            if (realtimeDebounceRef.current)
              clearTimeout(realtimeDebounceRef.current);
            realtimeDebounceRef.current = setTimeout(() => {
              fetchRecentActivity();
            }, 600);
          }
        },
      )
      // ---- user_activities realtime ----
      .on(
        "postgres_changes",
        { schema: "public", table: "user_activities", event: "*" },
        (payload) => {
          if (
            user &&
            userProfile &&
            userProfile.role === "admin" &&
            sessionStartTime
          ) {
            if (realtimeDebounceRef.current)
              clearTimeout(realtimeDebounceRef.current);
            realtimeDebounceRef.current = setTimeout(() => {
              fetchRecentActivity();
            }, 600);
          }
        },
      )
      .subscribe();

    return () => {
      clearInterval(timer);
      clearInterval(dataRefreshTimer);
      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = null;
      }
      // Gracefully unsubscribe from the realtime channel to avoid WebSocket errors
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [user, userProfile, sessionStartTime, isVisible]); // Now depends on user, userProfile, sessionStartTime, and visibility

  const occupancyRate =
    stats.totalSpaces > 0
      ? Math.round((stats.occupiedSpaces / stats.totalSpaces) * 100)
      : 0;

  // Progress ring math for Occupancy Overview
  const radius = 50; // matches r used in the SVG circle
  const circumference = 2 * Math.PI * radius; // ~314.16
  const dashOffset = circumference * (1 - occupancyRate / 100);

  return (
    <div className="min-h-screen bg-black relative">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                {/* Logo - Easily adjustable size */}
                <div
                  className="flex-shrink-0"
                  style={{ width: "80px", height: "80px" }}
                >
                  <img
                    src={wheelLogo}
                    alt="Parking Hub Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                {/* Title - Fixed positioning */}
                <div>
                  <h1 className="text-xl font-semibold text-yellow-400 whitespace-nowrap">
                    Parking Hub Admin
                  </h1>
                  <p className="text-sm text-gray-400">
                    {currentTime.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4 relative z-10">
              <div className="text-sm text-gray-300">
                Welcome,{" "}
                <span className="font-medium text-white">
                  {userProfile?.name || user?.email}
                </span>
                {userProfile?.role && (
                  <span className="ml-2 px-2 py-1 bg-yellow-400 text-black text-xs rounded font-medium uppercase">
                    {userProfile.role}
                  </span>
                )}
              </div>
              {/* Payment collection is handled in the user flow after booking confirmation. Removed admin trigger. */}
              <button
                onClick={async () => {
                  // Immediately clear all activity data before logout
                  setRecentActivity([]);
                  setAllActivities([]);
                  setParkingSpaces([]);
                  setStats({
                    totalSpaces: 0,
                    occupiedSpaces: 0,
                    availableSpaces: 0,
                    dailyRevenue: 0,
                    totalEarnings: 0,
                  });
                  setShowManageUsers(false);
                  setShowVehicleManagement(false);
                  setError("");
                  setCurrentTime(new Date()); // Reset time
                  // Set new session start time so lists are scoped after login
                  setSessionStartTime(null);
                  // Clear any error states
                  setError("");
                  setShowTotalSpace(false);
                  setShowAddSpaceModal(false);
                  setShowVehicleScanner(false);
                  setShowQRScanModal(false);
                  setShowAllActivitiesModal(false);
                  setShowManageUsers(false);
                  setShowVehicleManagement(false);

                  // Call the logout function
                  await onLogout();
                }}
                className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 border border-red-500/60 shadow hover:shadow-red-500/20"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="px-4 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div
              className="bg-gray-900 overflow-hidden shadow-lg rounded-lg border border-gray-800 cursor-pointer"
              onClick={() => setShowTotalSpace(true)}
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <svg
                        className="h-5 w-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m-9 0a2 2 0 012-2v-6a2 2 0 012 2v6a2 2 0 012 2h6a2 2 0 012-2v-6a2 2 0 012-2h-2m0 0h2m-1 0h-1"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-400 truncate">
                        Total Spaces
                      </dt>
                      <dd className="text-lg font-medium text-white">
                        {stats.totalSpaces}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 overflow-hidden shadow-lg rounded-lg border border-gray-800">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-red-500 rounded-md flex items-center justify-center">
                      <svg
                        className="h-5 w-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-400 truncate">
                        Occupied
                      </dt>
                      <dd className="text-lg font-medium text-white">
                        {stats.occupiedSpaces}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 overflow-hidden shadow-lg rounded-lg border border-gray-800">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-green-500 rounded-md flex items-center justify-center">
                      <svg
                        className="h-5 w-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-400 truncate">
                        Available
                      </dt>
                      <dd className="text-lg font-medium text-white">
                        {stats.availableSpaces}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 overflow-hidden shadow-lg rounded-lg border border-gray-800">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-yellow-400 rounded-md flex items-center justify-center">
                      <svg
                        className="h-5 w-5 text-black"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-400 truncate">
                        Daily Revenue
                      </dt>
                      <dd className="text-lg font-medium text-white">
                        ₱{stats.dailyRevenue}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 overflow-hidden shadow-lg rounded-lg border border-gray-800">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-emerald-500 rounded-md flex items-center justify-center">
                      <svg
                        className="h-5 w-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-400 truncate">
                        Total Earnings
                      </dt>
                      <dd className="text-lg font-medium text-white">
                        ₱{stats.totalEarnings}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Occupancy Chart and Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Occupancy Overview */}
            <div className="bg-gray-900 shadow-lg rounded-lg border border-gray-800">
              <div className="px-6 py-4 border-b border-gray-800">
                <h3 className="text-lg font-medium text-white">
                  Occupancy Overview
                </h3>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <svg className="w-32 h-32" viewBox="0 0 120 120">
                      <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="none"
                        stroke="#374151"
                        strokeWidth="10"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="10"
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={dashOffset}
                        transform="rotate(-90 60 60)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white">
                          {occupancyRate}%
                        </div>
                        <div className="text-sm text-gray-400">Occupied</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-lg font-semibold text-red-400">
                      {stats.occupiedSpaces}
                    </div>
                    <div className="text-sm text-gray-400">Occupied</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-green-400">
                      {stats.availableSpaces}
                    </div>
                    <div className="text-sm text-gray-400">Available</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-gray-900 shadow-lg rounded-lg border border-gray-800">
              <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
                <h3 className="text-lg font-medium text-white">
                  Recent Payments
                </h3>
                <button
                  onClick={() => setShowAllActivitiesModal(true)}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                >
                  View All
                </button>
              </div>
              <div className="p-6">
                <div className="flow-root">
                  <ul className="-mb-8">
                    {recentActivity.length > 0 ? (
                      recentActivity.map((activity) => (
                        <li key={activity.id}>
                          <div className="relative pb-8">
                            {activity.id !==
                              recentActivity[recentActivity.length - 1].id && (
                              <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-700" />
                            )}
                            <div className="relative flex space-x-3">
                              <div>
                                <span
                                  className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-gray-900 ${
                                    activity.type === "parking"
                                      ? "bg-blue-500"
                                      : activity.type === "booking"
                                        ? "bg-purple-500"
                                        : activity.type === "payment"
                                          ? "bg-yellow-400"
                                          : "bg-green-500"
                                  }`}
                                >
                                  {activity.type === "parking" && (
                                    <svg
                                      className="h-5 w-5 text-white"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}
                                  {activity.type === "booking" && (
                                    <svg
                                      className="h-5 w-5 text-white"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}
                                  {activity.type === "payment" && (
                                    <svg
                                      className="h-5 w-5 text-black"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M8 4a3 3 0 00-3 3v8a2 2 0 110 4 2 2 0 014 0V7a1 1 0 112 0v4"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}
                                  {activity.type === "admin" && (
                                    <svg
                                      className="h-5 w-5 text-white"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0 2 2 0 012 0 7 7 0 0114 0z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                <div>
                                  <p className="text-sm text-gray-300">
                                    {activity.description}
                                  </p>
                                  {activity.type === "admin" &&
                                    activity.details &&
                                    typeof activity.details === "object" && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        {Object.entries(activity.details).map(
                                          ([key, value]) => (
                                            <span key={key} className="mr-2">
                                              {key}: {value}
                                            </span>
                                          ),
                                        )}
                                      </div>
                                    )}
                                </div>
                                <div className="text-right text-sm whitespace-nowrap text-gray-400">
                                  {getTimeAgo(activity.time)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))
                    ) : (
                      <li>
                        <div className="relative pb-8">
                          <div className="relative flex space-x-3">
                            <div>
                              <span className="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-gray-900 bg-gray-700"></span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm text-gray-300">
                                  No recent activity
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* User Activity (Bookings) */}
            <div className="bg-gray-900 shadow-lg rounded-lg border border-gray-800">
              <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
                <h3 className="text-lg font-medium text-white">
                  User Activity
                </h3>
                <button
                  onClick={() => setShowAllUserActivitiesModal(true)}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                >
                  View All
                </button>
              </div>
              <div className="p-6">
                <div className="flow-root">
                  <ul className="-mb-8">
                    {recentUserActivity.length > 0 ? (
                      recentUserActivity.map((activity, index) => (
                        <li key={activity.id}>
                          <div className="relative pb-8">
                            {index !== recentUserActivity.length - 1 && (
                              <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-700" />
                            )}
                            <div className="relative flex space-x-3">
                              <div>
                                <span className="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-gray-900 bg-purple-500">
                                  <svg
                                    className="h-5 w-5 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                <div>
                                  <p className="text-sm text-gray-300">
                                    {activity.description}
                                  </p>
                                </div>
                                <div className="text-right text-sm whitespace-nowrap text-gray-400">
                                  {getTimeAgo(activity.time)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))
                    ) : (
                      <li>
                        <div className="relative pb-8">
                          <div className="relative flex space-x-3">
                            <div>
                              <span className="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-gray-900 bg-gray-700"></span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm text-gray-300">
                                  No user activity
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Admin Activity */}
            <div className="bg-gray-900 shadow-lg rounded-lg border border-gray-800">
              <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
                <h3 className="text-lg font-medium text-white">
                  Admin Activity
                </h3>
                <button
                  onClick={() => setShowAllAdminActivitiesModal(true)}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                >
                  View All
                </button>
              </div>
              <div className="p-6">
                <div className="flow-root">
                  <ul className="-mb-8">
                    {recentAdminActivity.length > 0 ? (
                      recentAdminActivity.map((activity, index) => (
                        <li key={activity.id}>
                          <div className="relative pb-8">
                            {index !== recentAdminActivity.length - 1 && (
                              <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-700" />
                            )}
                            <div className="relative flex space-x-3">
                              <div>
                                <span className="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-gray-900 bg-green-500">
                                  <svg
                                    className="h-5 w-5 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0 2 2 0 012 0 7 7 0 0114 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                <div>
                                  <p className="text-sm text-gray-300">
                                    {activity.description}
                                  </p>
                                </div>
                                <div className="text-right text-sm whitespace-nowrap text-gray-400">
                                  {getTimeAgo(activity.time)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))
                    ) : (
                      <li>
                        <div className="relative pb-8">
                          <div className="relative flex space-x-3">
                            <div>
                              <span className="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-gray-900 bg-gray-700"></span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm text-gray-300">
                                  No admin activity
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <div className="bg-gray-900 shadow-lg rounded-lg border border-gray-800">
              <div className="px-6 py-4 border-b border-gray-800">
                <h3 className="text-lg font-medium text-white">
                  Quick Actions
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <button
                    onClick={() => setShowAddSpaceModal(true)}
                    className="bg-blue-900 bg-opacity-50 hover:bg-blue-800 hover:bg-opacity-70 text-blue-300 p-4 rounded-lg text-center transition-colors border border-blue-700"
                  >
                    <svg
                      className="h-6 w-6 mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    <div className="text-sm font-medium">Add New Space</div>
                  </button>

                  <button
                    onClick={() => setShowVehicleScanner(true)}
                    className="bg-purple-900 bg-opacity-50 hover:bg-purple-800 hover:bg-opacity-70 text-purple-300 p-4 rounded-lg text-center transition-colors border border-purple-700"
                  >
                    <svg
                      className="h-6 w-6 mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 4a1 1 0 011-1h3m10 0h3a1 1 0 011 1v3m0 10v3a1 1 0 01-1 1h-3M7 3H4a1 1 0 00-1 1v3m0 10v3a1 1 0 001 1h3m8-12a2 2 0 11-4 0 2 2 0 014 0zm-7 7a7 7 0 0110-5.93M12 15v5"
                      />
                    </svg>
                    <div className="text-sm font-medium">Scan QR</div>
                  </button>

                  {/* View Reports Quick Action (opens modal) */}
                  <ViewReports
                    customTrigger={
                      <button className="bg-green-900 bg-opacity-50 hover:bg-green-800 hover:bg-opacity-70 text-green-300 p-4 rounded-lg text-center transition-colors border border-green-700">
                        <svg
                          className="h-6 w-6 mx-auto mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <div className="text-sm font-medium">View Reports</div>
                      </button>
                    }
                  />

                  <button
                    onClick={() => setShowManageUsers(true)}
                    className="bg-purple-900 bg-opacity-50 hover:bg-purple-800 hover:bg-opacity-70 text-purple-300 p-4 rounded-lg text-center transition-colors border border-purple-700"
                  >
                    <svg
                      className="h-6 w-6 mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <div className="text-sm font-medium">Manage Users</div>
                  </button>

                  <button
                    onClick={() => setShowVehicleManagement(true)}
                    className="bg-orange-900 bg-opacity-50 hover:bg-orange-800 hover:bg-opacity-70 text-orange-300 p-4 rounded-lg text-center transition-colors border border-orange-700"
                  >
                    <svg
                      className="h-6 w-6 mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      />
                    </svg>
                    <div className="text-sm font-medium">Manage Vehicles</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AddNewParking
        show={showAddSpaceModal}
        onClose={() => setShowAddSpaceModal(false)}
        onAdded={() => {
          fetchParkingSpaces();
          fetchRecentActivity();
        }}
      />

      <VehicleScanner
        visible={showVehicleScanner}
        onClose={() => setShowVehicleScanner(false)}
        onScan={async (qrText, action) => {
          try {
            const data = JSON.parse(qrText);
            let spaceId = data.space_id;
            let sessionId =
              data.sid || data.sessionId || data.id || data.session_id;

            // Fallback: if spaceId missing but we have sessionId, fetch space_id from session
            if (!spaceId && sessionId) {
              try {
                const { data: sessionRow, error: sessionFetchError } =
                  await supabase
                    .from("parking_sessions")
                    .select("space_id")
                    .eq("id", sessionId)
                    .single();
                if (!sessionFetchError && sessionRow?.space_id) {
                  spaceId = sessionRow.space_id;
                }
              } catch (fallbackErr) {
                console.warn(
                  "Could not fetch space_id from session fallback",
                  fallbackErr,
                );
              }
            }
            if (!spaceId) {
              alert("❌ Invalid QR code: No space ID found.");
              return;
            }

            if (action === "checkin") {
              const success = await handleCheckIn(spaceId, qrText);
              if (success) {
                // silently succeed, scanner will close on success
                setShowVehicleScanner(false);
              } else {
                alert("❌ Failed to check in vehicle. Please try again.");
              }
            } else if (action === "checkout") {
              const success = await handleCheckOut(spaceId, qrText);
              if (success) {
                // silently succeed, scanner will close on success
                setShowVehicleScanner(false);
              } else {
                alert("❌ Failed to check out vehicle. Please try again.");
              }
            }
          } catch (err) {
            console.error("Error parsing QR data:", err);
            alert("❌ Invalid QR code format.");
          }
        }}
      />

      {/* All Activities Modal */}
      {showAllActivitiesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] border border-gray-800">
            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">
                All Recent Activities
              </h3>
              <button
                onClick={() => setShowAllActivitiesModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="flow-root">
                <ul className="-mb-8">
                  {allActivities.length > 0 ? (
                    allActivities.map((activity, index) => (
                      <li key={activity.id}>
                        <div className="relative pb-8">
                          {index !== allActivities.length - 1 && (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-700" />
                          )}
                          <div className="relative flex space-x-3">
                            <div>
                              <span
                                className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-gray-900 ${
                                  activity.type === "parking"
                                    ? "bg-blue-500"
                                    : activity.type === "booking"
                                      ? "bg-purple-500"
                                      : activity.type === "payment"
                                        ? "bg-yellow-400"
                                        : "bg-green-500"
                                }`}
                              >
                                {activity.type === "parking" && (
                                  <svg
                                    className="h-5 w-5 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                                {activity.type === "booking" && (
                                  <svg
                                    className="h-5 w-5 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                                {activity.type === "payment" && (
                                  <svg
                                    className="h-5 w-5 text-black"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M8 4a3 3 0 00-3 3v8a2 2 0 110 4 2 2 0 014 0V7a1 1 0 112 0v4"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                                {activity.type === "admin" && (
                                  <svg
                                    className="h-5 w-5 text-white"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0 2 2 0 012 0 7 7 0 0114 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm text-gray-300">
                                  {activity.description}
                                </p>
                                {activity.type === "admin" &&
                                  activity.details &&
                                  typeof activity.details === "object" && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {Object.entries(activity.details).map(
                                        ([key, value]) => (
                                          <span key={key} className="mr-2">
                                            {key}: {value}
                                          </span>
                                        ),
                                      )}
                                    </div>
                                  )}
                              </div>
                              <div className="text-right text-sm whitespace-nowrap text-gray-400">
                                {getTimeAgo(activity.time)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li>
                      <div className="relative pb-8">
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-gray-900 bg-gray-700"></span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-300">
                                No recent activity
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All User Activities Modal */}
      {showAllUserActivitiesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] border border-gray-800">
            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">
                All User Activities
              </h3>
              <button
                onClick={() => setShowAllUserActivitiesModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="flow-root">
                <ul className="-mb-8">
                  {allUserActivities.length > 0 ? (
                    allUserActivities.map((activity, index) => (
                      <li key={activity.id}>
                        <div className="relative pb-8">
                          {index !== allUserActivities.length - 1 && (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-700" />
                          )}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-gray-900 bg-purple-500">
                                <svg
                                  className="h-5 w-5 text-white"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm text-gray-300">
                                  {activity.description}
                                </p>
                              </div>
                              <div className="text-right text-sm whitespace-nowrap text-gray-400">
                                {getTimeAgo(activity.time)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li>
                      <div className="relative pb-8">
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-gray-900 bg-gray-700"></span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-300">
                                No user activity
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Admin Activities Modal */}
      {showAllAdminActivitiesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] border border-gray-800">
            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">
                All Admin Activities
              </h3>
              <button
                onClick={() => setShowAllAdminActivitiesModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="flow-root">
                <ul className="-mb-8">
                  {allAdminActivities.length > 0 ? (
                    allAdminActivities.map((activity, index) => (
                      <li key={activity.id}>
                        <div className="relative pb-8">
                          {index !== allAdminActivities.length - 1 && (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-700" />
                          )}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-gray-900 bg-green-500">
                                <svg
                                  className="h-5 w-5 text-white"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0 2 2 0 012 0 7 7 0 0114 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm text-gray-300">
                                  {activity.description}
                                </p>
                              </div>
                              <div className="text-right text-sm whitespace-nowrap text-gray-400">
                                {getTimeAgo(activity.time)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li>
                      <div className="relative pb-8">
                        <div className="relative flex space-x-3">
                          <div>
                            <span className="h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-gray-900 bg-gray-700"></span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-300">
                                No admin activity
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Scan Modal */}
      {showQRScanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-md w-full border border-gray-800">
            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">
                {scanType === "checkin"
                  ? "Check-in Vehicle"
                  : "Check-out Vehicle"}
              </h3>
              <button
                onClick={() => {
                  setShowQRScanModal(false);
                  setError("");
                  setScannedQR("");
                  setSelectedSpaceId(null);
                  setBookingDetails(null);
                  setDetailedBookingInfo(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form onSubmit={handleQRScanSubmit} className="p-6">
              <div className="space-y-4">
                {/* Show detailed booking information */}
                {detailedBookingInfo && (
                  <div className="bg-gray-800 p-4 rounded-md mb-4 border border-yellow-400">
                    <h4 className="text-lg font-bold text-yellow-400 mb-3 flex items-center">
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        ></path>
                      </svg>
                      Booking Details
                    </h4>

                    {/* User Information */}
                    <div className="mb-3 bg-gray-700 p-3 rounded">
                      <h5 className="text-sm font-semibold text-blue-400 mb-1">
                        👤 Customer
                      </h5>
                      <p className="text-white font-medium">
                        {detailedBookingInfo.user_name}
                      </p>
                    </div>

                    {/* Vehicle Information */}
                    <div className="mb-3 bg-gray-700 p-3 rounded">
                      <h5 className="text-sm font-semibold text-green-400 mb-1">
                        🚗 Vehicle Details
                      </h5>
                      <div className="space-y-1">
                        <p className="text-white">
                          <span className="text-gray-400">Plate:</span>{" "}
                          <span className="font-mono font-bold">
                            {detailedBookingInfo.vehicle_plate}
                          </span>
                        </p>
                        <p className="text-white">
                          <span className="text-gray-400">Make:</span>{" "}
                          {detailedBookingInfo.vehicle_make}
                        </p>
                        <p className="text-white">
                          <span className="text-gray-400">Model:</span>{" "}
                          {detailedBookingInfo.vehicle_model}
                        </p>
                        <p className="text-white">
                          <span className="text-gray-400">Color:</span>{" "}
                          {detailedBookingInfo.vehicle_color}
                        </p>
                      </div>
                    </div>

                    {/* Parking Space Information */}
                    <div className="mb-3 bg-gray-700 p-3 rounded">
                      <h5 className="text-sm font-semibold text-purple-400 mb-1">
                        🅿️ Parking Space
                      </h5>
                      <div className="space-y-1">
                        <p className="text-white">
                          <span className="text-gray-400">Space:</span>{" "}
                          {detailedBookingInfo.space_number}
                        </p>
                        <p className="text-white">
                          <span className="text-gray-400">Section:</span>{" "}
                          {detailedBookingInfo.space_section}
                        </p>
                        <p className="text-white">
                          <span className="text-gray-400">Address:</span>{" "}
                          {detailedBookingInfo.space_address}
                        </p>
                      </div>
                    </div>

                    {/* Booking Time Information */}
                    <div className="mb-3 bg-gray-700 p-3 rounded">
                      <h5 className="text-sm font-semibold text-orange-400 mb-1">
                        📅 Booking Period
                      </h5>
                      <div className="space-y-1">
                        <p className="text-white">
                          <span className="text-gray-400">Start:</span>{" "}
                          {detailedBookingInfo.start_time
                            ? new Date(
                                detailedBookingInfo.start_time,
                              ).toLocaleString()
                            : "N/A"}
                        </p>
                        <p className="text-white">
                          <span className="text-gray-400">End:</span>{" "}
                          {detailedBookingInfo.end_time
                            ? new Date(
                                detailedBookingInfo.end_time,
                              ).toLocaleString()
                            : "N/A"}
                        </p>
                        <p className="text-white">
                          <span className="text-gray-400">Status:</span>{" "}
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              detailedBookingInfo.status === "active"
                                ? "bg-green-600 text-white"
                                : detailedBookingInfo.status === "completed"
                                  ? "bg-blue-600 text-white"
                                  : "bg-yellow-600 text-black"
                            }`}
                          >
                            {detailedBookingInfo.status || "Unknown"}
                          </span>
                        </p>
                        {detailedBookingInfo.total_amount && (
                          <p className="text-white">
                            <span className="text-gray-400">Amount:</span> ₱
                            {detailedBookingInfo.total_amount}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Fallback: Show basic booking details if detailed info not available */}
                {bookingDetails && !detailedBookingInfo && (
                  <div className="bg-gray-800 p-4 rounded-md mb-4">
                    <h4 className="text-sm font-medium text-yellow-400 mb-2">
                      Basic QR Data
                    </h4>
                    {bookingDetails.sid && (
                      <p className="text-xs text-gray-300">
                        Session ID: {bookingDetails.sid}
                      </p>
                    )}
                    {bookingDetails.vehicle_id && (
                      <p className="text-xs text-gray-300">
                        Vehicle ID: {bookingDetails.vehicle_id}
                      </p>
                    )}
                    {bookingDetails.start && (
                      <p className="text-xs text-gray-300">
                        Duration:{" "}
                        {new Date(bookingDetails.start).toLocaleDateString()} -{" "}
                        {new Date(bookingDetails.end).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="scanned_qr"
                    className="block text-sm font-medium text-gray-400 mb-1"
                  >
                    QR Code Data
                  </label>
                  <textarea
                    id="scanned_qr"
                    value={scannedQR}
                    onChange={(e) => setScannedQR(e.target.value)}
                    placeholder="Scanned QR code data will appear here"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                    rows="3"
                    required
                    readOnly={!!bookingDetails}
                  />
                </div>
                <div>
                  <label
                    htmlFor="space_id"
                    className="block text-sm font-medium text-gray-400 mb-1"
                  >
                    Parking Space
                  </label>
                  <select
                    id="space_id"
                    value={selectedSpaceId}
                    onChange={(e) => setSelectedSpaceId(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select a parking space</option>
                    {parkingSpaces.map((space) => (
                      <option key={space.id} value={space.id}>
                        {space.space_number} ({space.section})
                      </option>
                    ))}
                  </select>
                </div>

                {error && <div className="text-red-500 text-sm">{error}</div>}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowQRScanModal(false);
                    setError("");
                    setScannedQR("");
                    setSelectedSpaceId(null);
                    setBookingDetails(null);
                    setDetailedBookingInfo(null);
                  }}
                  className="mr-3 px-4 py-2 bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700 focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none"
                >
                  {scanType === "checkin" ? "Check-in" : "Check-out"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Total Space Modal */}
      <TotalSpace
        visible={showTotalSpace}
        onClose={() => setShowTotalSpace(false)}
        parkingSpaces={parkingSpaces}
        onOccupiedSpaceClick={(space) => {
          setSelectedOccupiedSpace(space);
          setShowOccupiedDetails(true);
        }}
      />

      {/* Occupied Space Details Modal */}
      <OccupiedSpaceDetails
        visible={showOccupiedDetails}
        onClose={() => {
          setShowOccupiedDetails(false);
          setSelectedOccupiedSpace(null);
        }}
        spaceId={selectedOccupiedSpace?.id}
        onCheckoutSuccess={() => {
          // Refresh parking spaces after successful checkout
          fetchParkingSpaces();
          setShowOccupiedDetails(false);
          setSelectedOccupiedSpace(null);
        }}
      />

      {/* Manage Users Modal */}
      <ManageUsers
        show={showManageUsers}
        onClose={() => setShowManageUsers(false)}
      />

      <VehicleManagement
        isOpen={showVehicleManagement}
        onClose={() => setShowVehicleManagement(false)}
      />
    </div>
  );
};

export default AdminDashboard;
