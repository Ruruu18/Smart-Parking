import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVehicles, Vehicle } from '../contexts/vehicles/VehicleContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  // When provided, limit list and creation to this type
  restrictType?: VehicleType;
}

type VehicleType = 'car' | 'truck' | 'van' | 'pickup' | 'bike' | 'motorcycle' | 'scooter';

const vehicleTypes: { key: VehicleType; label: string; icon: string }[] = [
  { key: 'car', label: 'Car', icon: 'car-sport-outline' },
  { key: 'truck', label: 'Truck', icon: 'car-outline' },
  { key: 'van', label: 'Van', icon: 'bus-outline' },
  { key: 'pickup', label: 'Pickup', icon: 'car-outline' },
  { key: 'bike', label: 'Bike', icon: 'bicycle-outline' },
  { key: 'motorcycle', label: 'Motorcycle', icon: 'bicycle-outline' },
  { key: 'scooter', label: 'Scooter', icon: 'hardware-chip-outline' },
];

const VehicleManagementModal: React.FC<Props> = ({ visible, onClose, restrictType }) => {
  const { vehicles, addVehicle, updateVehicle, deleteVehicle, refresh } = useVehicles();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    vehicle_type: (restrictType || 'car') as VehicleType,
    vehicle_model: '',
    vehicle_plate_number: '',
  });

  useEffect(() => {
    if (visible) {
      refresh();
    }
  }, [visible]);

  useEffect(() => {
    // Update vehicle type when restrictType changes
    if (restrictType && !editingVehicle) {
      setFormData(prev => ({
        ...prev,
        vehicle_type: restrictType
      }));
    }
  }, [restrictType, editingVehicle]);

  const resetForm = () => {
    setFormData({
      vehicle_type: restrictType || 'car',
      vehicle_model: '',
      vehicle_plate_number: '',
    });
    setIsAddingNew(false);
    setEditingVehicle(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!formData.vehicle_model.trim() || !formData.vehicle_plate_number.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      if (editingVehicle) {
        // Update existing vehicle
        const success = await updateVehicle(editingVehicle.id, formData);
        if (success) {
          Alert.alert('Success', 'Vehicle updated successfully');
          resetForm();
          refresh();
        } else {
          Alert.alert('Error', 'Failed to update vehicle');
        }
      } else {
        // Add new vehicle
        const id = await addVehicle(formData);
        if (id) {
          Alert.alert('Success', 'Vehicle added successfully');
          resetForm();
          refresh();
        } else {
          Alert.alert('Error', 'Failed to add vehicle. This plate number might already exist.');
        }
      }
    } catch (error) {
      console.error('Error saving vehicle:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      vehicle_type: vehicle.vehicle_type,
      vehicle_model: vehicle.vehicle_model,
      vehicle_plate_number: vehicle.vehicle_plate_number,
    });
    setIsAddingNew(true);
  };

  const handleDelete = (vehicle: Vehicle) => {
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to delete ${vehicle.vehicle_model} (${vehicle.vehicle_plate_number})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteVehicle(vehicle.id);
            if (success) {
              Alert.alert('Success', 'Vehicle deleted successfully');
              refresh();
            } else {
              Alert.alert('Error', 'Failed to delete vehicle');
            }
          },
        },
      ]
    );
  };

  const renderVehicleItem = ({ item }: { item: Vehicle }) => {
    const vehicleTypeInfo = vehicleTypes.find(t => t.key === item.vehicle_type) || vehicleTypes[0];
    
    return (
      <View style={styles.vehicleItem}>
        <View style={styles.vehicleInfo}>
          <View style={styles.vehicleHeader}>
            <Ionicons name={vehicleTypeInfo.icon as any} size={24} color="#FFD700" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.vehicleModel}>{item.vehicle_model}</Text>
              <Text style={styles.vehicleDetails}>
                {vehicleTypeInfo.label} • {item.vehicle_plate_number}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.vehicleActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#FFD700' }]}
            onPress={() => handleEdit(item)}
          >
            <Ionicons name="pencil" size={16} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#FF3B30' }]}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderVehicleTypeSelector = () => (
    <View style={styles.typeSelector}>
      <Text style={styles.fieldLabel}>Vehicle Type</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeOptions}>
        {(restrictType ? vehicleTypes.filter(t => t.key === restrictType) : vehicleTypes).map((type) => {
          const isSelected = formData.vehicle_type === type.key;
          return (
            <TouchableOpacity
              key={type.key}
              style={[styles.typeOption, isSelected && styles.typeOptionSelected]}
              onPress={() => setFormData({ ...formData, vehicle_type: type.key })}
            >
              <Ionicons
                name={type.icon as any}
                size={20}
                color={isSelected ? '#000' : '#FFD700'}
              />
              <Text style={[styles.typeLabel, isSelected && styles.typeLabelSelected]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>My Vehicles</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={24} color="#FFD700" />
            </TouchableOpacity>
          </View>

          {!isAddingNew ? (
            <>
              <FlatList
                data={restrictType ? vehicles.filter(v => v.vehicle_type === restrictType) : vehicles}
                keyExtractor={(item) => item.id}
                renderItem={renderVehicleItem}
                style={styles.vehicleList}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No {restrictType ? restrictType : ''} vehicles yet. Add your first vehicle!</Text>
                }
              />

              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setIsAddingNew(true)}
              >
                <Ionicons name="add" size={20} color="#000" />
                <Text style={styles.addButtonText}>Add New Vehicle</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
              <Text style={styles.formTitle}>
                {editingVehicle ? 'Edit Vehicle' : `Add New ${restrictType ? restrictType.charAt(0).toUpperCase() + restrictType.slice(1) : 'Vehicle'}`}
              </Text>

              {renderVehicleTypeSelector()}

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Vehicle Model</Text>
                <TextInput
                  placeholder="e.g., Toyota Camry, Honda Civic"
                  placeholderTextColor="#666"
                  style={styles.input}
                  value={formData.vehicle_model}
                  onChangeText={(text) => setFormData({ ...formData, vehicle_model: text })}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Plate Number</Text>
                <TextInput
                  placeholder="e.g., ABC-1234"
                  placeholderTextColor="#666"
                  style={styles.input}
                  value={formData.vehicle_plate_number}
                  onChangeText={(text) => setFormData({ ...formData, vehicle_plate_number: text.toUpperCase() })}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>
                    {editingVehicle ? 'Update' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  },
  container: {
    width: '92%',
    maxHeight: '85%',
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#fff',
    fontFamily: 'Raleway-Bold',
    fontSize: 22,
  },
  closeBtn: {
    padding: 4,
  },
  vehicleList: {
    maxHeight: 300,
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleModel: {
    color: '#fff',
    fontFamily: 'Raleway-SemiBold',
    fontSize: 16,
  },
  vehicleDetails: {
    color: '#ccc',
    fontFamily: 'Rakkas-Regular',
    fontSize: 14,
    marginTop: 2,
  },
  vehicleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    justifyContent: 'center',
  },
  addButtonText: {
    marginLeft: 8,
    fontFamily: 'Raleway-Bold',
    color: '#000',
    fontSize: 16,
  },
  emptyText: {
    color: '#ccc',
    textAlign: 'center',
    fontFamily: 'Raleway-Regular',
    fontSize: 16,
    marginTop: 20,
  },
  formContainer: {
    maxHeight: 400,
  },
  formTitle: {
    color: '#FFD700',
    fontFamily: 'Raleway-Bold',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  typeSelector: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: '#fff',
    fontFamily: 'Raleway-SemiBold',
    fontSize: 16,
    marginBottom: 8,
  },
  typeOptions: {
    flexDirection: 'row',
  },
  typeOption: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
    marginRight: 8,
    minWidth: 80,
  },
  typeOptionSelected: {
    backgroundColor: '#FFD700',
  },
  typeLabel: {
    color: '#FFD700',
    fontFamily: 'Raleway-Medium',
    fontSize: 12,
    marginTop: 4,
  },
  typeLabelSelected: {
    color: '#000',
  },
  field: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontFamily: 'Raleway-Regular',
    fontSize: 16,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#666',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontFamily: 'Raleway-SemiBold',
    fontSize: 16,
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#FFD700',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#000',
    fontFamily: 'Raleway-Bold',
    fontSize: 16,
  },
});

export default VehicleManagementModal;