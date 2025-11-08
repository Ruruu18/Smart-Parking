import React, { useMemo, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { differenceInCalendarDays } from 'date-fns';
import { BookingInfo } from '../home/booking/BookingReceiptModal';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/auth/AuthContext';
import { PAYMONGO_CHECKOUT, API_BASE_URL } from '../../config/api';

type PaymentChoiceModalProps = {
  visible: boolean;
  booking: BookingInfo | null;
  onClose: () => void;
  onPaid: (paymentRow: any) => void;
};

const PaymentChoiceModal: React.FC<PaymentChoiceModalProps> = ({ visible, booking, onClose, onPaid }) => {
  const [submitting, setSubmitting] = useState<null | 'cash' | 'gcash'>(null);
  const { user } = useAuth();

  const { amountDue, daysBooked } = useMemo(() => {
    if (!booking) return { amountDue: 0, daysBooked: 0 };
    const dailyRate = Number(booking.space?.daily_rate ?? 0);
    const start = booking.startTime instanceof Date ? booking.startTime : new Date(booking.startTime);
    const end = booking.endTime instanceof Date ? booking.endTime : new Date(booking.endTime);

    // Calculate actual calendar days difference (Nov 9 to Nov 16 = 7 days)
    const days = differenceInCalendarDays(end, start);

    // Validate: Must have at least 1 day booking (prevent same-day bookings)
    if (days < 1) {
      console.warn('Invalid booking: Same-day or negative duration detected');
      return { amountDue: 0, daysBooked: 0 };
    }

    return { amountDue: Math.round(dailyRate * days), daysBooked: days };
  }, [booking]);

  // Guard to prevent duplicate payment insert when deep link fires multiple times
  const processedRef = useRef(false);

  if (!visible || !booking) return null;

  const insertPayment = async (method: 'cash' | 'gcash') => {
    if (!booking.sessionId) {
      Alert.alert('Error', 'Missing session. Please try again.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to make a payment.');
      return;
    }

    // Validate booking duration
    if (daysBooked < 1) {
      Alert.alert('Invalid Booking', 'End date must be at least 1 day after start date. Please go back and select a valid date range.');
      return;
    }

    try {
      setSubmitting(method);
      
      if (method === 'cash') {
        // Handle cash payment (existing logic)
        const { data, error } = await supabase
          .from('payments')
          .insert([
            {
              session_id: booking.sessionId,
              user_id: user.id,
              amount: amountDue,
              payment_method: method,
              status: 'completed',
            },
          ])
          .select()
          .single();

        if (error) throw error;
        onPaid(data);
      } else if (method === 'gcash') {
        // Create PayMongo checkout session via backend and open the URL
        try {
          // Listen for deep link return to the app and record payment
          const cleanup = (sub?: any) => {
            try { sub?.remove?.(); } catch {}
          };

          const handleUrl = async ({ url }: { url: string }) => {
            try {
              if (processedRef.current) return;
              if (!url || !url.includes('payments/result')) return;
              const match = url.match(/[?&]status=([^&]+)/);
              const status = match ? decodeURIComponent(match[1]) : '';
              if (status !== 'success') return;
              processedRef.current = true;
              console.log('[Payments] Deep link received', url);

              const { data, error } = await supabase
                .from('payments')
                .insert([
                  {
                    session_id: booking.sessionId,
                    user_id: user.id,
                    amount: amountDue,
                    payment_method: 'gcash',
                    status: 'completed',
                  },
                ])
                .select()
                .single();

              if (error) throw error;
              onPaid(data);
              Alert.alert('Payment Success', 'GCash payment recorded.');
              cleanup(sub);
            } catch (e: any) {
              console.error('Post-payment handling failed:', e);
              Alert.alert('Payment Notice', 'Payment completed but failed to record. Please refresh.');
            }
          };

          const sub = Linking.addEventListener('url', handleUrl);
          // Build Expo (exp://) deep links for Expo Go and pass them via redirect param
          const expSuccess = ExpoLinking.createURL('payments/result?status=success', { scheme: 'exp' });
          const expCancel = ExpoLinking.createURL('payments/result?status=cancelled', { scheme: 'exp' });
          const successUrl = `${API_BASE_URL}/paymongo/return?status=success&redirect=${encodeURIComponent(expSuccess)}`;
          const cancelUrl = `${API_BASE_URL}/paymongo/return?status=cancelled&redirect=${encodeURIComponent(expCancel)}`;

          const resp = await fetch(PAYMONGO_CHECKOUT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: amountDue,
              description: `Parking Fee - ${booking.space.space_number}`,
              email: user?.email,
              metadata: {
                session_id: booking.sessionId,
                user_id: user?.id,
                space_id: booking.space.id,
                space_number: booking.space.space_number,
                days: daysBooked,
                source: 'mobile',
              },
              payment_method_types: ['gcash'],
              success_url: successUrl,
              cancel_url: cancelUrl,
            }),
          });

          const contentType = resp.headers.get('content-type') || '';
          const data = contentType.includes('application/json') ? await resp.json() : await resp.text();

          if (!resp.ok) {
            const msg = typeof data === 'string' ? data : (data?.error ? JSON.stringify(data.error) : 'Failed to create checkout');
            throw new Error(msg);
          }

          const url = typeof data === 'object' ? data.checkout_url : null;
          if (!url) throw new Error('Checkout URL not returned');
          await Linking.openURL(url);

          // Handle cold-start case: if the app was relaunched by the deep link,
          // the 'url' event may not fire. Check initial URL after a short delay.
          setTimeout(async () => {
            try {
              if (processedRef.current) return;
              const initial = await Linking.getInitialURL();
              if (initial) await handleUrl({ url: initial });
            } catch (e) {
              console.log('[Payments] getInitialURL check failed', e);
            }
          }, 1500);

          // Ensure we clean up the listener if user cancels or navigates away
          setTimeout(() => cleanup(sub), 5 * 60 * 1000); // auto-clean after 5 minutes
        } catch (err: any) {
          console.error('GCash checkout failed:', err);
          Alert.alert('GCash Error', err?.message || 'Unable to start GCash payment.');
        }
      }
    } catch (e: any) {
      console.error('Payment insert failed:', e);
      Alert.alert('Payment Failed', e?.message || 'Unable to record payment.');
    } finally {
      setSubmitting(null);
    }
  };







  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose Payment Method</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Parking Space</Text>
            <Text style={styles.summaryValue}>{booking.space.space_number} • {booking.space.section || booking.space.address || 'Space'}</Text>

            <Text style={[styles.summaryLabel, { marginTop: 10 }]}>Duration</Text>
            <Text style={styles.summaryValue}>{daysBooked} day{daysBooked > 1 ? 's' : ''}</Text>

            <Text style={[styles.summaryLabel, { marginTop: 10 }]}>Amount Due</Text>
            <Text style={styles.amount}>₱{amountDue}</Text>
          </View>

          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={[styles.payButton, styles.cashButton]}
              onPress={() => insertPayment('cash')}
              disabled={!!submitting}
            >
              {submitting === 'cash' ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="cash-outline" size={20} color="#000" />
                  <Text style={styles.payButtonTextDark}>Pay Cash</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.payButton, styles.gcashButton]}
              onPress={() => insertPayment('gcash')}
              disabled={!!submitting}
            >
              {submitting === 'gcash' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="phone-portrait-outline" size={20} color="#fff" />
                  <Text style={styles.payButtonText}>GCash</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {submitting === 'gcash' && (
            <Text style={styles.helperText}>Creating GCash payment link... You will be redirected to complete the payment.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  summaryBox: {
    backgroundColor: '#1b1b1b',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  summaryLabel: {
    color: '#aaa',
    fontSize: 12,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 14,
    marginTop: 2,
  },
  amount: {
    color: '#FFD700',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  payButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  cashButton: {
    backgroundColor: '#FFD700',
  },
  gcashButton: {
    backgroundColor: '#3b82f6',
  },
  payButtonText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 8,
  },
  payButtonTextDark: {
    color: '#000',
    fontWeight: '700',
    marginLeft: 8,
  },
  helperText: {
    color: '#888',
    fontSize: 12,
    marginTop: 10,
  },
});

export default PaymentChoiceModal;


