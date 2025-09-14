import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: { name?: string | null; email?: string | null } | null;
  onLogout: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ visible, onClose, user, onLogout }) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackground}>
        <View style={[styles.modalContainer, { maxHeight: height * 0.4 }]}>            
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>User Profile</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.modalContent}>
            {/* Name */}
            <View style={styles.profileItem}>
              <View style={styles.iconWrapper}>
                <Ionicons name="person" size={18} color="#000" />
              </View>
              <Text style={styles.profileText}>{user?.name || 'User'}</Text>
            </View>
            {/* Email */}
            <View style={styles.profileItem}>
              <View style={styles.iconWrapper}>
                <Ionicons name="mail" size={18} color="#000" />
              </View>
              <Text style={styles.profileText}>{user?.email || 'Email not available'}</Text>
            </View>
            {/* Logout */}
            <TouchableOpacity
              style={[styles.logoutButton, { marginTop: 20 }]}
              onPress={onLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#000000" style={{ marginRight: 8 }} />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#111',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    // clean header without border
    backgroundColor: '#111',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Raleway-Bold',
    color: '#FFD700',
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    // no separator line
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileText: {
    fontSize: 17,
    fontFamily: 'Raleway-Medium',
    color: '#E0E0E0',
  },
  logoutButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 14,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButtonText: {
    fontSize: 16,
    fontFamily: 'Raleway-Bold',
    color: '#000000',
  },
});

export default ProfileModal;