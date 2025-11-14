import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BookingReceiptModal, { BookingInfo } from '../home/booking/BookingReceiptModal';
import PaymentChoiceModal from '../payments/PaymentChoiceModal';
import { useAuth } from '../../contexts/auth/AuthContext';
import { supabase } from '../../supabase';

interface ParkingSession {
  id: string;
  space_id: string;
  start_time: string;
  end_time: string | null;
  status: string;
  created_at: string;
  vehicle_id?: string | null;
}

const ACTIVE_STATUSES = ['booked', 'checked_in', 'in_progress'];

const HistoryScreen: React.FC<any> = ({ navigation }) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBooking, setSelectedBooking] = useState<BookingInfo | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [paymentChoiceVisible, setPaymentChoiceVisible] = useState<boolean>(false);
  const [paymentBooking, setPaymentBooking] = useState<BookingInfo | null>(null);
  const [sessionIdToPaymentStatus, setSessionIdToPaymentStatus] = useState<Record<string, 'completed' | 'pending' | 'failed' | 'refunded' | 'none'>>({});

  // Get screen dimensions for responsive design
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const isSmallScreen = screenWidth < 375;
  const isMediumScreen = screenWidth >= 375 && screenWidth < 414;
  const isLargeScreen = screenWidth >= 414;
  
  // Get status bar height for proper spacing
  const statusBarHeight = StatusBar.currentHeight || 0;
  const isAndroid = Platform.OS === 'android';

  useEffect(() => {
    fetchSessions();

    // Real-time subscription for parking_sessions changes
    const sessionChannel = supabase
      .channel(`parking_sessions_user_${user?.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'parking_sessions',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          console.log('[History] Session change detected:', payload);
          fetchSessions(); // Refresh the list
        }
      )
      .subscribe();

    // Real-time subscription for payment changes
    const paymentChannel = supabase
      .channel(`payments_user_${user?.id}_history`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          console.log('[History] Payment change detected:', payload);
          fetchSessions(); // Refresh to update payment status
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      sessionChannel.unsubscribe();
      paymentChannel.unsubscribe();
    };
  }, [user?.id]);

  const fetchSessions = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('parking_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
    } else if (data) {
      setSessions(data as ParkingSession[]);
      try {
        const ids = (data as ParkingSession[]).map((s) => s.id);
        if (ids.length > 0) {
          const { data: pays } = await supabase
            .from('payments')
            .select('session_id, status, created_at')
            .in('session_id', ids)
            .order('created_at', { ascending: false });
          const map: Record<string, 'completed' | 'pending' | 'failed' | 'refunded' | 'none'> = {};
          (pays || []).forEach((p) => {
            if (!map[p.session_id]) map[p.session_id] = p.status as any;
          });
          ids.forEach((id) => { if (!map[id]) map[id] = 'none'; });
          setSessionIdToPaymentStatus(map);
        } else {
          setSessionIdToPaymentStatus({});
        }
      } catch {}
    }

    setLoading(false);
  };

  // Normalize DB timestamps that may be stored without timezone
  const parseDbTime = (ts: string | null | undefined): Date | null => {
    if (!ts) return null;
    try {
      const str = String(ts);
      const hasT = str.includes('T');
      const hasTZ = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(str);
      const normalized = `${hasT ? str : str.replace(' ', 'T')}${hasTZ ? '' : 'Z'}`;
      const d = new Date(normalized);
      return isNaN(d as any) ? null : d;
    } catch {
      return null;
    }
  };

  const openReceipt = async (session: ParkingSession) => {
    try {
      const { data: space, error } = await supabase
        .from('parking_spaces')
        .select('*')
        .eq('id', session.space_id)
        .single();
      if (error) {
        console.error('Error fetching space:', error);
        return;
      }
      const booking: BookingInfo = {
        space: space as any,
        startTime: new Date(session.start_time),
        endTime: new Date(session.end_time ?? session.start_time),
        sessionId: session.id,
        vehicleId: session.vehicle_id ?? null,
      };
      setSelectedBooking(booking);
      setModalVisible(true);
    } catch (err) {
      console.error('openReceipt', err);
    }
  };

  const openPayment = async (session: ParkingSession) => {
    try {
      const { data: space } = await supabase
        .from('parking_spaces')
        .select('*')
        .eq('id', session.space_id)
        .single();
      const booking: BookingInfo = {
        space: space as any,
        startTime: new Date(session.start_time),
        endTime: new Date(session.end_time ?? session.start_time),
        sessionId: session.id,
        vehicleId: session.vehicle_id ?? null,
      };
      setPaymentBooking(booking);
      setPaymentChoiceVisible(true);
    } catch {}
  };

  const activeSessions = sessions.filter((s) => ACTIVE_STATUSES.includes(s.status));
  const pastSessions = sessions.filter((s) => !ACTIVE_STATUSES.includes(s.status));

  const getStatusStyles = (status: string, styles: any) => {
    switch (status) {
      case 'booked':
        return { badgeStyle: styles.badgeBooked, textColor: '#000', icon: 'bookmark' };
      case 'checked_in':
        return { badgeStyle: styles.badgeCheckedIn, textColor: '#fff', icon: 'checkmark-circle' };
      case 'in_progress':
        return { badgeStyle: styles.badgeInProgress, textColor: '#fff', icon: 'time' };
      default:
        return { badgeStyle: styles.badgeCompleted, textColor: '#fff', icon: 'checkmark-done' };
    }
  };

  const renderItem = ({ item }: { item: ParkingSession }) => {
    const isActive = ACTIVE_STATUSES.includes(item.status);
    // Create dynamic styles for this render
    const dynamicStyles = createStyles(screenWidth, screenHeight, statusBarHeight, isAndroid);
    const { badgeStyle, textColor, icon } = getStatusStyles(item.status, dynamicStyles);
    const payStatus = sessionIdToPaymentStatus[item.id] || 'none';
    const iconSize = isSmallScreen ? 12 : 14;

    return (
      <TouchableOpacity disabled={!isActive} onPress={() => openReceipt(item)}>
        <View style={dynamicStyles.card}>
          <View style={dynamicStyles.rowBetween}>
            <View style={[dynamicStyles.badge, badgeStyle]}>
              <Ionicons 
                name={icon as any} 
                size={iconSize} 
                color={textColor} 
                style={dynamicStyles.badgeIcon} 
              />
              <Text style={[dynamicStyles.badgeText, { color: textColor }]} numberOfLines={1}> 
                {item.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            <Text style={dynamicStyles.date} numberOfLines={1}>
              {(parseDbTime(item.created_at) ?? new Date(item.created_at)).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: isSmallScreen ? '2-digit' : 'numeric',
              })}
            </Text>
          </View>

          <View style={dynamicStyles.rowBetween}>
            <Text style={dynamicStyles.timeLabel}>Start</Text>
            <Text style={dynamicStyles.time} numberOfLines={1}>
              {(parseDbTime(item.start_time) ?? new Date(item.start_time)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View style={dynamicStyles.rowBetween}>
            <Text style={dynamicStyles.timeLabel}>Payment</Text>
            <TouchableOpacity onPress={() => (payStatus === 'completed' ? null : openPayment(item))}>
              <Text style={[dynamicStyles.paymentStatus, 
                payStatus === 'completed' ? dynamicStyles.psCompleted : payStatus === 'pending' ? dynamicStyles.psPending : dynamicStyles.psNone
              ]} numberOfLines={1}>
                {payStatus === 'none' ? 'Pay Now' : payStatus.charAt(0).toUpperCase() + payStatus.slice(1)}
              </Text>
            </TouchableOpacity>
          </View>

          {item.end_time && !isActive && (
            <View style={dynamicStyles.rowBetween}>
              <Text style={dynamicStyles.timeLabel}>End</Text>
              <Text style={dynamicStyles.time} numberOfLines={1}>
                {(parseDbTime(item.end_time) ?? new Date(item.end_time)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Create dynamic styles for the current screen
  const dynamicStyles = createStyles(screenWidth, screenHeight, statusBarHeight, isAndroid);
  const iconSize = isSmallScreen ? 24 : isMediumScreen ? 26 : 28;

  if (loading) {
    return (
      <SafeAreaView style={dynamicStyles.center}>
        <ActivityIndicator color="#FFD700" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={dynamicStyles.backButton}>
          <Ionicons name="arrow-back" size={iconSize} color="#FFD700" />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>History</Text>
      </View>

      {activeSessions.length > 0 && (
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Active Booking</Text>
          <FlatList
            data={activeSessions}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={dynamicStyles.listContainer}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={10}
          />
        </View>
      )}

      <View style={[dynamicStyles.section, { flex: 1 }]}>
        <Text style={dynamicStyles.sectionTitle}>Past Bookings</Text>
        {pastSessions.length === 0 ? (
          <Text style={dynamicStyles.emptyText}>No past bookings.</Text>
        ) : (
          <FlatList
            data={pastSessions}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={dynamicStyles.listContainer}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={10}
            style={{ flex: 1 }}
          />
        )}
      </View>
      
      <BookingReceiptModal
        visible={modalVisible}
        booking={selectedBooking}
        onClose={() => setModalVisible(false)}
      />
      <PaymentChoiceModal
        visible={paymentChoiceVisible}
        booking={paymentBooking}
        onClose={() => setPaymentChoiceVisible(false)}
        onPaid={() => {
          setPaymentChoiceVisible(false);
          fetchSessions();
        }}
      />
    </SafeAreaView>
  );
};

// Create responsive styles based on screen dimensions
const createStyles = (screenWidth: number, screenHeight: number, statusBarHeight: number = 0, isAndroid: boolean = false) => {
  const isSmallScreen = screenWidth < 375;
  const isMediumScreen = screenWidth >= 375 && screenWidth < 414;
  const isLargeScreen = screenWidth >= 414;

  // Responsive values
  const horizontalPadding = isSmallScreen ? 12 : isMediumScreen ? 16 : 20;
  const headerFontSize = isSmallScreen ? 20 : isMediumScreen ? 22 : 24;
  const sectionTitleFontSize = isSmallScreen ? 16 : isMediumScreen ? 18 : 20;
  const cardPadding = isSmallScreen ? 14 : isMediumScreen ? 18 : 24;
  const cardVerticalPadding = isSmallScreen ? 16 : isMediumScreen ? 18 : 20;
  const badgePadding = isSmallScreen ? 8 : isMediumScreen ? 10 : 12;
  const iconSize = isSmallScreen ? 24 : isMediumScreen ? 26 : 28;
  
  // Status bar spacing - more aggressive for Android
  const topPadding = isAndroid ? Math.max(statusBarHeight + 16, 40) : 16;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
      paddingHorizontal: horizontalPadding,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#000',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: topPadding,
      marginBottom: isSmallScreen ? 20 : 24,
      paddingHorizontal: 4,
      minHeight: 44, // Ensure minimum touch target
    },
    headerTitle: {
      color: '#FFD700',
      fontSize: headerFontSize,
      fontFamily: 'Raleway-Bold',
      marginLeft: isSmallScreen ? 8 : 12,
      flex: 1,
    },
    section: {
      marginBottom: isSmallScreen ? 24 : 32,
    },
    sectionTitle: {
      color: '#FFD700',
      fontSize: sectionTitleFontSize,
      fontFamily: 'Raleway-Bold',
      marginBottom: isSmallScreen ? 12 : 16,
      paddingHorizontal: 4,
    },
    card: {
      backgroundColor: '#1c1c1e',
      borderRadius: isSmallScreen ? 12 : 16,
      paddingVertical: cardVerticalPadding,
      paddingHorizontal: cardPadding,
      marginBottom: isSmallScreen ? 12 : 16,
      marginHorizontal: 2,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: isSmallScreen ? 8 : 10,
      minHeight: 24,
    },
    date: {
      color: '#8e8e93',
      fontFamily: 'Raleway-Regular',
      fontSize: isSmallScreen ? 11 : 12,
      flexShrink: 1,
    },
    time: {
      color: '#ffffff',
      fontFamily: 'Raleway-Medium',
      fontSize: isSmallScreen ? 13 : 14,
      flexShrink: 1,
    },
    paymentStatus: {
      fontFamily: 'Raleway-Bold',
      fontSize: isSmallScreen ? 11 : 12,
      flexShrink: 1,
    },
    psCompleted: { color: '#34C759' },
    psPending: { color: '#FFD700' },
    psNone: { color: '#8e8e93' },
    emptyText: {
      color: '#8e8e93',
      fontFamily: 'Raleway-Regular',
      fontSize: isSmallScreen ? 14 : 16,
      textAlign: 'center',
      marginTop: 20,
      marginHorizontal: 20,
      lineHeight: isSmallScreen ? 20 : 24,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: badgePadding,
      paddingVertical: isSmallScreen ? 4 : 6,
      borderRadius: 999,
      maxWidth: screenWidth * 0.5,
    },
    badgeText: {
      fontFamily: 'Raleway-Bold',
      fontSize: isSmallScreen ? 10 : 12,
      flexShrink: 1,
    },
    badgeBooked: {
      backgroundColor: '#FFCD38',
    },
    badgeCheckedIn: {
      backgroundColor: '#34C759',
    },
    badgeInProgress: {
      backgroundColor: '#0A84FF',
    },
    badgeCompleted: {
      backgroundColor: '#8E8E93',
    },
    timeLabel: {
      fontFamily: 'Raleway-Regular',
      color: '#8e8e93',
      fontSize: isSmallScreen ? 11 : 12,
      flexShrink: 0,
      minWidth: 60,
    },
    // List container styles for better spacing
    listContainer: {
      paddingBottom: 20,
    },
    // Icon in badge
    badgeIcon: {
      marginRight: 4,
    },
    // Back button with proper touch target
    backButton: {
      padding: 8,
      marginLeft: -8, // Extend touch area to screen edge
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
};

// Static styles removed - now using dynamic styles in component

export default HistoryScreen;
