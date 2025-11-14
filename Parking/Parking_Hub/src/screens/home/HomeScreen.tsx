import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ScrollView,
  Image,
  FlatList,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/auth/AuthContext';
import { supabase } from '../../supabase';
import ProfileModal from './modal/ProfileModal';
import ParkingSeeMoreModal from './modal/ParkingSeeMoreModal';
import ParkingDetails from './modal/ParkingDetails';
import BookingReceiptModal, { BookingInfo } from './booking/BookingReceiptModal';
import PaymentChoiceModal from '../payments/PaymentChoiceModal';
import { VehicleProvider } from '../../contexts/vehicles/VehicleContext';
import VehicleManagementModal from '../../components/VehicleManagementModal';
import {
  createResponsiveStyles,
  scaledFont,
  scaledSpacing,
  getIconSize,
  getCardPadding
} from '../../utils/responsive';


// Local fallback image for parking spaces
// NOTE: path is relative to this file: src/screens/home/HomeScreen.tsx -> ../../../assets/images/Car.jpg
const FALLBACK_IMAGE = require('../../../assets/images/Car.jpg');

type HomeScreenProps = {
  navigation: any;
};

const HomeScreen = ({ navigation }: HomeScreenProps) => {
  const { user, logout } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  const [greeting, setGreeting] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [parkingSpots, setParkingSpots] = useState<any[]>([]);
  const [loadingSpots, setLoadingSpots] = useState<boolean>(true);
  const [showAllModal, setShowAllModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Modal state for single parking space details
  const [selectedSpace, setSelectedSpace] = useState<any | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  // Booking state
  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [paymentChoiceVisible, setPaymentChoiceVisible] = useState(false);
  const [paymentBooking, setPaymentBooking] = useState<BookingInfo | null>(null);

  // Track previous session status for real-time updates
  const previousSessionStatusRef = useRef<string | null>(null);
  // Track which session has been notified about expiration to prevent duplicate alerts
  const notifiedSessionRef = useRef<string | null>(null);
  // BLOCK modal from showing after checkout to prevent glitches - USE STATE NOT REF to force re-render
  const [checkoutCompleted, setCheckoutCompleted] = useState<boolean>(false);

  const openDetail = (space: any) => {
    setSelectedSpace(space);
    setDetailVisible(true);
  };

  const closeDetail = () => {
    setDetailVisible(false);
    setSelectedSpace(null);
  };

  // Fetch parking spaces from Supabase
  const fetchParkingSpots = async () => {
    setLoadingSpots(true);
    const { data, error } = await supabase
      .from('parking_spaces')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching parking spaces:', error);
    } else if (data) {
      // Show only available (not occupied) spaces to users
      setParkingSpots(data.filter((s) => !s.is_occupied));
    }
    setLoadingSpots(false);
  };

  // Fetch active booking for current user (if any)
  const fetchActiveBooking = async (): Promise<BookingInfo | null> => {
    if (!user?.id) return null;

    // BLOCK: Don't fetch or set anything if checkout was just completed
    if (checkoutCompleted) {
      console.log('[fetchActiveBooking] BLOCKED - checkout completed');
      return null;
    }

    try {
      // 1. Look for the most recent session that is still active
      const { data: sessionRows, error: sessionErr } = await supabase
        .from('parking_sessions')
        .select('id, space_id, vehicle_id, start_time, end_time, status')
        .eq('user_id', user.id)
        .in('status', ['booked', 'checked_in', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (sessionErr) throw sessionErr;
      if (!sessionRows || sessionRows.length === 0) {
        setBookingInfo(null);
        return null;
      }

      const session = sessionRows[0];

      // Store the current status for real-time comparison
      previousSessionStatusRef.current = session.status;

      // 2. Retrieve parking space details (if space_id is not null)
      let space = null;
      if (session.space_id) {
        const { data: spaceData, error: spaceErr } = await supabase
          .from('parking_spaces')
          .select('*')
          .eq('id', session.space_id)
          .single();

        if (spaceErr) {
          console.warn('Error fetching space details:', spaceErr);
          // Don't throw - space might have been deleted
        } else {
          space = spaceData;
        }
      } else {
        console.log('Session has no space_id (space may have been deleted)');
      }

      // Only set booking info if we have a space
      if (space) {
        const activeBooking: BookingInfo = {
          space: space as any,
          startTime: new Date(session.start_time),
          endTime: new Date(session.end_time),
          sessionId: session.id,
          vehicleId: session.vehicle_id,
        };

        setBookingInfo(activeBooking);
        return activeBooking;
      } else {
        // No space available, clear booking info
        setBookingInfo(null);
        return null;
      }
    } catch (e) {
      console.error('Error fetching active booking:', e);
      setBookingInfo(null);
      return null;
    }
  };

  // Initial fetch & realtime subscription
  useEffect(() => {
    fetchParkingSpots();

    const channel = supabase
      .channel('public:parking_spaces_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'parking_spaces' }, (payload) => {
        const newSpace = payload.new;
        if (!newSpace.is_occupied) {
          setParkingSpots((prev) => [newSpace, ...prev]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'parking_spaces' }, (payload) => {
        const updated = payload.new;
        setParkingSpots((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s)).filter((s) => !s.is_occupied)
        );
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'parking_spaces' }, (payload) => {
        const removedId = payload.old.id;
        setParkingSpots((prev) => prev.filter((s) => s.id !== removedId));
      })
      .subscribe();

    // Poll every 60 seconds in case realtime misses something
    const pollId = setInterval(() => {
      fetchParkingSpots();
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollId);
    };
  }, []);

  // Load active booking whenever user logs in / HomeScreen mounts
  useEffect(() => {
    fetchActiveBooking();

    if (!user?.id) return;

    // Subscribe to session updates for this user
    const sessionChannel = supabase
      .channel(`public:parking_sessions_user_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'parking_sessions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('=== [Real-time] Session UPDATE event received ===');
          console.log('[Real-time] Full payload:', JSON.stringify(payload, null, 2));
          console.log('[Real-time] payload.new:', payload.new);
          console.log('[Real-time] payload.old:', payload.old);

          const newStatus = payload.new?.status;
          const oldStatus = payload.old?.status;

          console.log('[Real-time] Status comparison:', {
            oldStatus,
            newStatus,
            previousStatusRef: previousSessionStatusRef.current,
            userId: payload.new?.user_id,
            hasOldStatus: !!oldStatus,
            hasNewStatus: !!newStatus,
            statusChanged: oldStatus !== newStatus
          });

          // Check if this is a status change
          if (oldStatus && newStatus && oldStatus !== newStatus) {
            console.log(`[Real-time] ✅ CONFIRMED STATUS CHANGE: ${oldStatus} → ${newStatus}`);

            if (newStatus === 'checked_in' && oldStatus === 'booked') {
              console.log('[Real-time] 🎯 CHECK-IN DETECTED');

              // Update ref immediately to prevent double processing
              previousSessionStatusRef.current = newStatus;

              // Close ALL modals FIRST - force close immediately
              setBookingModalVisible(false);
              setDetailVisible(false);
              setShowAllModal(false);
              setPaymentChoiceVisible(false);
              setShowProfileModal(false);
              setShowVehicleModal(false);

              console.log('[Real-time] All modals closed for check-in');

              // Small delay to ensure modals are fully closed before navigation
              setTimeout(() => {
                // Navigate to History
                navigation.navigate('History' as never);
                console.log('[Real-time] ✅ Navigated to History screen');

                // Show alert after navigation
                setTimeout(() => {
                  Alert.alert(
                    '✅ Check-In Successful!',
                    'Your vehicle has been checked in.',
                    [{ text: 'OK' }]
                  );
                }, 200);
              }, 50);
            } else if (newStatus === 'completed' && oldStatus === 'checked_in') {
              console.log('=== [CHECKOUT DEBUG] START ===');

              // Prevent duplicate processing
              if (previousSessionStatusRef.current === 'completed') {
                console.log('[CHECKOUT DEBUG] ❌ ALREADY PROCESSED - SKIPPING');
                return;
              }

              // Update refs and STATE IMMEDIATELY - state update will force re-render and unmount modal
              previousSessionStatusRef.current = newStatus;
              setCheckoutCompleted(true); // THIS WILL FORCE RE-RENDER AND UNMOUNT MODAL

              // Clear ALL state immediately - FORCE MODAL CLOSED FIRST
              setBookingInfo(null);
              setPaymentBooking(null);
              setBookingModalVisible(false);
              setPaymentChoiceVisible(false);
              setDetailVisible(false);
              setShowAllModal(false);
              setShowProfileModal(false);
              setShowVehicleModal(false);

              console.log('[CHECKOUT DEBUG] ✅ Checkout complete - all states cleared');

              // Show alert after a small delay to let modals unmount
              setTimeout(() => {
                Alert.alert(
                  '↩️ Check-Out Complete!',
                  'Thank you for using our parking service.',
                  [{ text: 'OK' }]
                );
              }, 200);
            } else {
              console.log('[Real-time] ⚠️ Status change but no matching transition:', { oldStatus, newStatus });
              previousSessionStatusRef.current = newStatus;
              fetchActiveBooking();
            }
          } else if (!oldStatus && newStatus) {
            console.log('[Real-time] ⚠️ Update without old status (possibly INSERT or incomplete data)');
            // Don't show confirmation, just update ref
            previousSessionStatusRef.current = newStatus;
          } else if (oldStatus === newStatus) {
            console.log('[Real-time] No status change (other fields updated)');
            // Don't update ref or fetch unnecessarily
          } else {
            console.log('[Real-time] ❌ Unexpected payload structure');
          }
          console.log('=== [Real-time] Event processing complete ===');
        }
      )
      .subscribe();

    // Subscribe to payment updates for this user's sessions
    const paymentChannel = supabase
      .channel(`public:payments_user_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'payments',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const paymentStatus = payload.new?.status;

          // Show payment success alert
          if (paymentStatus === 'completed') {
            Alert.alert(
              '💳 Payment Successful!',
              'Your payment has been processed successfully.',
              [{ text: 'OK' }]
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(paymentChannel);
    };
  }, [user?.id]);

  // Debounce search input to avoid running filter on every keystroke
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // No longer needed - checkout state will handle this
  // Force close modals when checkout is completed
  useEffect(() => {
    if (checkoutCompleted) {
      console.log('[useEffect] Checkout state detected - ensuring modals stay closed');
      setBookingModalVisible(false);
      setPaymentChoiceVisible(false);
      setDetailVisible(false);
      setShowAllModal(false);
    }
  }, [checkoutCompleted]);

  // Monitor for expiring parking sessions (10 minutes warning)
  useEffect(() => {
    // Check every minute for sessions about to expire
    const checkExpiration = () => {
      if (!bookingInfo || !bookingInfo.endTime || !bookingInfo.sessionId) {
        return;
      }

      const now = new Date();
      const endTime = new Date(bookingInfo.endTime);
      const timeUntilExpiry = endTime.getTime() - now.getTime();
      const minutesUntilExpiry = Math.floor(timeUntilExpiry / (1000 * 60));

      // Check if session is expiring within 10 minutes and hasn't been notified yet
      if (minutesUntilExpiry <= 10 && minutesUntilExpiry > 0 && notifiedSessionRef.current !== bookingInfo.sessionId) {
        // Mark this session as notified
        notifiedSessionRef.current = bookingInfo.sessionId;

        // Show expiration warning alert
        Alert.alert(
          '⏰ Parking Session Expiring Soon!',
          `Your parking session will end in ${minutesUntilExpiry} minute${minutesUntilExpiry !== 1 ? 's' : ''}. Please return to your vehicle or extend your booking.`,
          [
            {
              text: 'OK',
              style: 'default',
            },
          ],
          { cancelable: false }
        );

        console.log(`[Expiration Alert] Session ${bookingInfo.sessionId} expires in ${minutesUntilExpiry} minutes`);
      } else if (minutesUntilExpiry <= 0) {
        // Session has already expired
        console.log(`[Expiration] Session ${bookingInfo.sessionId} has already expired`);
        // Reset notification ref for expired session
        if (notifiedSessionRef.current === bookingInfo.sessionId) {
          notifiedSessionRef.current = null;
        }
      }
    };

    // Check immediately on mount/booking change
    checkExpiration();

    // Then check every 60 seconds
    const intervalId = setInterval(checkExpiration, 60000);

    return () => {
      clearInterval(intervalId);
    };
  }, [bookingInfo]);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchParkingSpots();
    setRefreshing(false);
  }, []);

  // All categories are always visible
  const vehicleCategories = React.useMemo(() => (
    [
      { key: 'all', label: 'All', icon: 'grid-outline' as const },
      { key: 'car', label: 'Car', icon: 'car-sport-outline' as const },
      { key: 'truck', label: 'Truck', icon: 'car-outline' as const },
      { key: 'van', label: 'Van', icon: 'bus-outline' as const },
      { key: 'pickup', label: 'Pickup', icon: 'car-outline' as const },
      { key: 'bike', label: 'Bike', icon: 'bicycle-outline' as const },
      { key: 'motorcycle', label: 'Motorcycle', icon: 'bicycle-outline' as const },
      { key: 'scooter', label: 'Scooter', icon: 'hardware-chip-outline' as const },
    ]
  ), []);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting('Good Morning');
    } else if (hour < 18) {
      setGreeting('Good Afternoon');
    } else {
      setGreeting('Good Evening');
    }
  }, []);

  // Filter & search logic
  const filteredSpots = React.useMemo(() => {
    let list = parkingSpots;

    const hasQuery = debouncedQuery.trim().length > 0;

    // If user is searching, ignore category selection to broaden results.
    if (hasQuery) {
      const q = debouncedQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.space_number?.toLowerCase().includes(q) ||
          s.category?.toLowerCase().includes(q) ||
          (s.address ?? s.section)?.toLowerCase().includes(q)
      );
    } else if (selectedCategory && selectedCategory !== 'all') {
      // Apply category filter only when no search query AND not "All" selected
      list = list.filter((s) => (s.category?.toLowerCase() ?? 'other') === selectedCategory);
    }
    // If selectedCategory is 'all', show all parking spots (no filtering)

    // Sort alphabetically by space_number for consistency
    return [...list].sort((a, b) => (a.space_number > b.space_number ? 1 : -1));
  }, [parkingSpots, selectedCategory, debouncedQuery]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }]
      });
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  // Create a booking session in Supabase and mark the space as occupied
  const createBooking = async (booking: BookingInfo): Promise<string | null> => {
    try {
      // 1. Insert new session
      const { data: sessionInsert, error: insertErr } = await supabase
        .from('parking_sessions')
        .insert([
          {
            user_id: user?.id,
            space_id: booking.space.id,
            vehicle_id: booking.vehicleId, // Now properly UUID type
            start_time: booking.startTime.toISOString(),
            end_time: booking.endTime.toISOString(), // use normalized end time for inclusive day calc
            status: 'booked',
          },
        ])
        .select()
        .single();

      if (insertErr) throw insertErr;

      // 2. Mark the parking space as occupied so admin sees it immediately
      const { error: updateErr } = await supabase
        .from('parking_spaces')
        .update({ is_occupied: true })
        .eq('id', booking.space.id);

      if (updateErr) throw updateErr;

      // Return the created session id so we can encode it in the QR
      return sessionInsert?.id ?? null;
    } catch (e) {
      console.error('Error creating booking:', e);
      Alert.alert('Booking Failed', 'Unable to create booking. Please try again.');
      return null;
    }
  };

  const handleStartBooking = async (booking: BookingInfo) => {
    // Reset checkout flag - allow modal to show for new booking
    setCheckoutCompleted(false);

    // Optimistic UI: close the detail modal right away
    closeDetail();

    // Create booking in backend
    const sessionId = await createBooking(booking);

    if (sessionId) {
      // Prepare booking with session id, then show payment choice FIRST
      const bookingWithSession: BookingInfo = { ...booking, sessionId };
      setBookingInfo(bookingWithSession);
      setPaymentBooking(bookingWithSession);
      setPaymentChoiceVisible(true);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFD700" />}
      >
        {/* Top action bar */}
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.profileIcon}
            onPress={() => setShowProfileModal(true)}
          >
            <Ionicons name="person-outline" size={28} color="#FFD700" />
          </TouchableOpacity>
          


          <View style={styles.topRightIcons}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setShowVehicleModal(true)}
            >
              <Ionicons name="car-outline" size={24} color="#FFD700" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('History')}
            >
              <Ionicons name="time-outline" size={24} color="#FFD700" />
            </TouchableOpacity>
            {/* Notifications removed */}
          </View>
        </View>

        {/* Greeting */}
        <View style={{ marginTop: 20 }}>
          <Text style={styles.greetingText}>
            {greeting}, <Text style={styles.greetingName}>{user?.name || 'Guest'}</Text>
          </Text>
          <Text style={styles.subtitle}>Find the best place to <Text style={styles.greetingName}>park</Text></Text>
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, { marginTop: 24 }]}>
          <Ionicons name="search" size={20} color="#6E6E6E" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search"
            placeholderTextColor="#6E6E6E"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ paddingLeft: 4 }}>
              <Ionicons name="close-circle" size={18} color="#6E6E6E" />
            </TouchableOpacity>
          )}
        </View>

        {/* Categories – horizontally scrollable */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {vehicleCategories.map((item) => {
            const selected = item.key === selectedCategory;
            return (
              <View key={item.key} style={{ alignItems: 'center', marginRight: 24, marginBottom: 20 }}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCategory(item.key);
                    setSearchQuery('');
                  }}
                  style={[styles.categoryItem, selected && styles.categoryItemSelected]}
                >
                  <Ionicons
                    name={item.icon}
                    size={24}
                    color={selected ? '#000' : '#FFD700'}
                  />
                </TouchableOpacity>
                <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>
                  {item.label}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Nearby section header */}
        <Text style={styles.sectionHeader}>Parking Available Spots</Text>

        {/* Parking available spaces */}
        {loadingSpots ? (
          <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={filteredSpots.slice(0, 3)}
            keyExtractor={(item) => item.id.toString()}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.spotCard} onPress={() => openDetail(item)}>
                {/* Fallback image if none provided in DB */}
                <Image
                  source={item.image ? { uri: item.image } : FALLBACK_IMAGE}
                  style={styles.spotImage}
                />
                <View style={styles.spotInfo}>
                  <Text style={styles.spotName}>
                    <Text style={styles.spotNamePrefix}>{`${item.category ?? 'Other'} / `}</Text>
                    <Text style={styles.spotNameNumber}>{item.space_number}</Text>
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Ionicons name="location-outline" size={14} color="#FF3B30" />
                    <Text style={styles.spotAddress}>{item.address ?? item.section}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceMain}>₱{item.daily_rate ?? '-'}</Text>
                    <Text style={styles.priceUnit}>/day</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <Text style={{ color: '#ccc', textAlign: 'center', marginTop: 12 }}>
                No available parking spaces right now.
              </Text>
            )}
          />
        )}
        {/* See more button */}
        {!loadingSpots && filteredSpots.length > 3 && (
          <TouchableOpacity onPress={() => setShowAllModal(true)} style={{ alignSelf: 'center', marginTop: 8 }}>
            <Text style={{ color:'#FFD700', fontFamily:'Raleway-Medium' }}>
              {selectedCategory === 'all'
                ? 'See more Spaces'
                : `See more ${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}`
              }
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Profile Modal */}
      <ProfileModal
        visible={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={{ name: user?.name, email: user?.email }}
        onLogout={() => {
          setShowProfileModal(false);
          Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: handleLogout },
          ]);
        }}
      />
      <ParkingSeeMoreModal
        visible={showAllModal}
        onClose={() => setShowAllModal(false)}
        spaces={filteredSpots}
        onStartBooking={handleStartBooking}
      />
      <ParkingDetails visible={detailVisible} onClose={closeDetail} space={selectedSpace} onStartBooking={handleStartBooking} />
      {/* Vehicle Management Modal */}
      <VehicleManagementModal
        visible={showVehicleModal}
        onClose={() => setShowVehicleModal(false)}
      />
      {/* Payment choice before showing receipt */}
      {paymentBooking !== null && !checkoutCompleted && paymentChoiceVisible && (
        <PaymentChoiceModal
          visible={true}
          booking={paymentBooking}
          onClose={() => setPaymentChoiceVisible(false)}
          onPaid={() => {
            setPaymentChoiceVisible(false);
            // ONLY show booking modal if NOT after checkout
            if (!checkoutCompleted) {
              setBookingModalVisible(true);
            }
          }}
        />
      )}
      {/* Booking receipt (shown after payment choice) */}
      {bookingInfo !== null && !checkoutCompleted && bookingModalVisible && (
        <BookingReceiptModal
          key={bookingInfo.sessionId}
          visible={true}
          onClose={() => setBookingModalVisible(false)}
          booking={bookingInfo}
        />
      )}
    </SafeAreaView>
  );
};

const createStyles = () => {
  const responsive = createResponsiveStyles();
  const cardPadding = getCardPadding();
  
  const profileIconSize = responsive.isSmallScreen ? 48 : responsive.isMediumScreen ? 52 : 56;
  const iconButtonSize = responsive.isSmallScreen ? 38 : responsive.isMediumScreen ? 42 : 44;
  const categoryItemSize = responsive.isSmallScreen ? 56 : responsive.isMediumScreen ? 60 : 64;
  const spotImageWidth = responsive.isSmallScreen ? 90 : responsive.isMediumScreen ? 100 : 110;
  const spotImageHeight = responsive.isSmallScreen ? 75 : responsive.isMediumScreen ? 82 : 90;
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
      paddingHorizontal: responsive.padding,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: scaledSpacing(8),
    },
    profileIcon: {
      width: profileIconSize,
      height: profileIconSize,
      borderRadius: profileIconSize / 2,
      borderWidth: 2,
      borderColor: '#FFD700',
      justifyContent: 'center',
      alignItems: 'center',
    },
    topRightIcons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconButton: {
      width: iconButtonSize,
      height: iconButtonSize,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: '#FFD700',
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: scaledSpacing(12),
    },
    greetingText: {
      fontFamily: 'Raleway-Medium',
      fontSize: scaledFont(20),
      color: '#fff',
    },
    greetingName: {
      color: '#FFD700',
      fontFamily: 'Raleway-Bold',
    },
    subtitle: {
      fontFamily: 'Raleway-Light',
      fontSize: scaledFont(18),
      color: '#ccc',
      marginTop: 4,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#1a1a1a',
      borderRadius: 12,
      paddingHorizontal: cardPadding,
      paddingVertical: Platform.OS === 'ios' ? scaledSpacing(14) : scaledSpacing(8),
    },
    searchInput: {
      flex: 1,
      fontFamily: 'Raleway-Regular',
      color: '#fff',
      fontSize: scaledFont(16),
    },
    categoryItem: {
      width: categoryItemSize,
      height: categoryItemSize,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: '#FFD700',
      justifyContent: 'center',
      alignItems: 'center',
    },
    categoryItemSelected: {
      backgroundColor: '#FFD700',
    },
    categoryLabel: {
      marginTop: 6,
      fontFamily: 'Raleway-Regular',
      color: '#ccc',
      fontSize: scaledFont(12),
    },
    categoryLabelSelected: {
      color: '#FFD700',
      fontFamily: 'Raleway-Bold',
    },
    sectionHeader: {
      fontFamily: 'Raleway-Bold',
      fontSize: scaledFont(18),
      color: '#FFD700',
      marginTop: scaledSpacing(16),
      marginBottom: scaledSpacing(8),
    },
    spotCard: {
      flexDirection: 'row',
      backgroundColor: '#1a1a1a',
      borderRadius: 20,
      overflow: 'hidden',
      marginBottom: scaledSpacing(16),
    },
    spotImage: {
      width: spotImageWidth,
      height: spotImageHeight,
    },
    spotInfo: {
      flex: 1,
      padding: cardPadding,
    },
    spotName: {
      fontSize: scaledFont(18),
      color: '#fff',
    },
    spotNamePrefix: {
      fontFamily: 'Raleway-SemiBold',
    },
    spotNameNumber: {
      fontFamily: 'Rakkas-Regular',
    },
    spotAddress: {
      fontFamily: 'Raleway-Regular',
      fontSize: scaledFont(12),
      color: '#ccc',
      marginLeft: 4,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginTop: 4,
    },
    priceMain: {
      fontFamily: 'Rakkas-Regular',
      color: '#FFD700',
      fontSize: scaledFont(26),
      lineHeight: scaledFont(30),
    },
    priceUnit: {
      fontFamily: 'Rakkas-Regular',
      color: '#FFD700',
      fontSize: scaledFont(14),
      marginLeft: 2,
      marginBottom: 2,
    },
    categoriesContainer: {
      flexDirection: 'row',
      paddingVertical: scaledSpacing(12),
      paddingHorizontal: 4,
    },
  });
};

const styles = createStyles();

// Wrap HomeScreen with VehicleProvider
const HomeScreenWithVehicles = (props: HomeScreenProps) => (
  <VehicleProvider>
    <HomeScreen {...props} />
  </VehicleProvider>
);

export default HomeScreenWithVehicles;