import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_BASE_URL = 'http://localhost:3000/api';

interface PaymentMethod {
  id: number;
  user_id: number;
  method_type: string;
  card_last_four: string;
  card_brand: string;
  expiry_month: number;
  expiry_year: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

interface PaymentHistory {
  id: number;
  user_id: number;
  booking_id: number;
  payment_method_id: number;
  amount: number;
  transaction_id: string;
  payment_status: string;
  payment_date: string;
  start_time: string;
  end_time: string;
  location: string;
  method_type: string;
  card_last_four: string;
}

interface PaymentScreenProps {
  userId: number;
}

const PaymentScreen: React.FC<PaymentScreenProps> = ({ userId }) => {
  const [activeTab, setActiveTab] = useState<'methods' | 'history'>('methods');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  
  // Form states
  const [methodType, setMethodType] = useState('credit_card');
  const [cardLastFour, setCardLastFour] = useState('');
  const [cardBrand, setCardBrand] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    fetchPaymentMethods();
    fetchPaymentHistory();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/payment-methods/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setPaymentMethods(data.paymentMethods);
      } else {
        Alert.alert('Error', 'Failed to load payment methods');
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      Alert.alert('Error', 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/payments/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setPaymentHistory(data.payments);
      } else {
        Alert.alert('Error', 'Failed to load payment history');
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
      Alert.alert('Error', 'Failed to load payment history');
    }
  };

  const resetForm = () => {
    setMethodType('credit_card');
    setCardLastFour('');
    setCardBrand('');
    setExpiryMonth('');
    setExpiryYear('');
    setIsDefault(false);
  };

  const handleSavePaymentMethod = async () => {
    if (!cardLastFour || !cardBrand || !expiryMonth || !expiryYear) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const url = editingMethod 
        ? `${API_BASE_URL}/payment-methods/${editingMethod.id}`
        : `${API_BASE_URL}/payment-methods`;
      
      const method = editingMethod ? 'PUT' : 'POST';
      
      const body = {
        userId,
        methodType,
        cardLastFour,
        cardBrand,
        expiryMonth: parseInt(expiryMonth),
        expiryYear: parseInt(expiryYear),
        isDefault,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        setModalVisible(false);
        setEditingMethod(null);
        resetForm();
        fetchPaymentMethods();
        Alert.alert('Success', editingMethod ? 'Payment method updated' : 'Payment method added');
      } else {
        Alert.alert('Error', data.message || 'Failed to save payment method');
      }
    } catch (error) {
      console.error('Error saving payment method:', error);
      Alert.alert('Error', 'Failed to save payment method');
    }
  };

  const handleEditPaymentMethod = (method: PaymentMethod) => {
    setEditingMethod(method);
    setMethodType(method.method_type);
    setCardLastFour(method.card_last_four);
    setCardBrand(method.card_brand);
    setExpiryMonth(method.expiry_month.toString());
    setExpiryYear(method.expiry_year.toString());
    setIsDefault(method.is_default);
    setModalVisible(true);
  };

  const handleDeletePaymentMethod = (methodId: number) => {
    Alert.alert(
      'Delete Payment Method',
      'Are you sure you want to delete this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deletePaymentMethod(methodId) },
      ]
    );
  };

  const deletePaymentMethod = async (methodId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/payment-methods/${methodId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        fetchPaymentMethods();
        Alert.alert('Success', 'Payment method deleted successfully');
      } else {
        Alert.alert('Error', data.message || 'Failed to delete payment method');
      }
    } catch (error) {
      console.error('Error deleting payment method:', error);
      Alert.alert('Error', 'Failed to delete payment method');
    }
  };

  const getPaymentMethodIcon = (type: string) => {
    switch (type) {
      case 'credit_card':
        return 'card';
      case 'debit_card':
        return 'card';
      case 'paypal':
        return 'wallet';
      case 'apple_pay':
        return 'phone-portrait';
      case 'google_pay':
        return 'phone-portrait';
      default:
        return 'wallet';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'failed':
        return '#F44336';
      case 'refunded':
        return '#9C27B0';
      default:
        return '#666';
    }
  };

  const renderPaymentMethodItem = ({ item }: { item: PaymentMethod }) => (
    <View style={styles.methodCard}>
      <View style={styles.methodHeader}>
        <View style={styles.methodInfo}>
          <Ionicons name={getPaymentMethodIcon(item.method_type)} size={24} color="#007AFF" />
          <View style={styles.methodDetails}>
            <Text style={styles.methodType}>{item.card_brand} •••• {item.card_last_four}</Text>
            <Text style={styles.methodExpiry}>
              Expires {item.expiry_month.toString().padStart(2, '0')}/{item.expiry_year}
            </Text>
          </View>
        </View>
        {item.is_default && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultText}>Default</Text>
          </View>
        )}
      </View>
      
      <View style={styles.methodActions}>
        <TouchableOpacity
          style={styles.editMethodButton}
          onPress={() => handleEditPaymentMethod(item)}
        >
          <Ionicons name="create" size={18} color="#4CAF50" />
          <Text style={styles.editMethodText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteMethodButton}
          onPress={() => handleDeletePaymentMethod(item.id)}
        >
          <Ionicons name="trash" size={18} color="#F44336" />
          <Text style={styles.deleteMethodText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPaymentHistoryItem = ({ item }: { item: PaymentHistory }) => (
    <View style={styles.historyCard}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyLocation}>{item.location}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.payment_status) }]}>
          <Text style={styles.statusText}>{item.payment_status.toUpperCase()}</Text>
        </View>
      </View>
      
      <Text style={styles.historyAmount}>${item.amount.toFixed(2)}</Text>
      <Text style={styles.historyDate}>
        {new Date(item.payment_date).toLocaleDateString()} at {new Date(item.payment_date).toLocaleTimeString()}
      </Text>
      <Text style={styles.historyMethod}>
        {item.method_type} •••• {item.card_last_four}
      </Text>
      
      {item.transaction_id && (
        <Text style={styles.transactionId}>Transaction ID: {item.transaction_id}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Payments</Text>
        {activeTab === 'methods' && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setEditingMethod(null);
              resetForm();
              setModalVisible(true);
            }}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'methods' && styles.activeTab]}
          onPress={() => setActiveTab('methods')}
        >
          <Text style={[styles.tabText, activeTab === 'methods' && styles.activeTabText]}>
            Payment Methods
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            Payment History
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'methods' ? (
        <FlatList
          data={paymentMethods}
          renderItem={renderPaymentMethodItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="card" size={64} color="#DDD" />
              <Text style={styles.emptyText}>No payment methods</Text>
              <Text style={styles.emptySubtext}>Add a payment method to get started</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={paymentHistory}
          renderItem={renderPaymentHistoryItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="time" size={64} color="#DDD" />
              <Text style={styles.emptyText}>No payment history</Text>
              <Text style={styles.emptySubtext}>Your payment transactions will appear here</Text>
            </View>
          }
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingMethod ? 'Edit Payment Method' : 'Add Payment Method'}
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Payment Type</Text>
              <View style={styles.pickerContainer}>
                <TouchableOpacity
                  style={[styles.pickerOption, methodType === 'credit_card' && styles.pickerOptionSelected]}
                  onPress={() => setMethodType('credit_card')}
                >
                  <Text style={styles.pickerText}>Credit Card</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pickerOption, methodType === 'debit_card' && styles.pickerOptionSelected]}
                  onPress={() => setMethodType('debit_card')}
                >
                  <Text style={styles.pickerText}>Debit Card</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Card Brand</Text>
              <TextInput
                style={styles.input}
                value={cardBrand}
                onChangeText={setCardBrand}
                placeholder="e.g., Visa, Mastercard"
              />

              <Text style={styles.inputLabel}>Last 4 Digits</Text>
              <TextInput
                style={styles.input}
                value={cardLastFour}
                onChangeText={setCardLastFour}
                placeholder="1234"
                maxLength={4}
                keyboardType="number-pad"
              />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Expiry Month</Text>
                  <TextInput
                    style={styles.input}
                    value={expiryMonth}
                    onChangeText={setExpiryMonth}
                    placeholder="MM"
                    maxLength={2}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.inputLabel}>Expiry Year</Text>
                  <TextInput
                    style={styles.input}
                    value={expiryYear}
                    onChangeText={setExpiryYear}
                    placeholder="YYYY"
                    maxLength={4}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setIsDefault(!isDefault)}
              >
                <Ionicons
                  name={isDefault ? 'checkbox' : 'checkbox-outline'}
                  size={24}
                  color="#007AFF"
                />
                <Text style={styles.checkboxText}>Set as default payment method</Text>
              </TouchableOpacity>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSavePaymentMethod}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
  },
  listContainer: {
    padding: 20,
  },
  methodCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  methodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodDetails: {
    marginLeft: 12,
  },
  methodType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  methodExpiry: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  defaultBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  methodActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  editMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  editMethodText: {
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '500',
  },
  deleteMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  deleteMethodText: {
    color: '#F44336',
    marginLeft: 4,
    fontWeight: '500',
  },
  historyCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyLocation: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  historyAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  historyMethod: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  transactionId: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  pickerContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  pickerOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  pickerOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  pickerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    flex: 1,
    marginRight: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  checkboxText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
});

export default PaymentScreen; 