import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

const ManageUsers = ({ show, onClose }) => {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'user',
    password: ''
  });

  // User details state
  const [userDetails, setUserDetails] = useState({
    profile: null,
    vehicles: [],
    sessions: [],
    payments: []
  });

  // Check if current user is admin
  if (!userProfile || userProfile.role !== 'admin') {
    return null;
  }

  // Fetch all users with their details
  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Fetch profiles (excluding admins)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'admin') // Exclude admin users
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch vehicles count for each user
      const userIds = profiles.map(profile => profile.id);
      const { data: vehicleCounts, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('user_id')
        .in('user_id', userIds);

      if (vehiclesError) {
        console.warn('Error fetching vehicle counts:', vehiclesError);
      }

      // Count vehicles per user
      const vehicleCountMap = {};
      if (vehicleCounts) {
        vehicleCounts.forEach(vehicle => {
          vehicleCountMap[vehicle.user_id] = (vehicleCountMap[vehicle.user_id] || 0) + 1;
        });
      }

      // Combine profile data with vehicle counts
      const usersWithCounts = profiles.map(profile => ({
        ...profile,
        vehicleCount: vehicleCountMap[profile.id] || 0
      }));

      setUsers(usersWithCounts);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  // Fetch detailed user information
  const fetchUserDetails = async (userId) => {
    setLoading(true);
    try {
      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Fetch user vehicles
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (vehiclesError) {
        console.warn('Error fetching vehicles:', vehiclesError);
      }

      // Fetch user parking sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('parking_sessions')
        .select(`
          *,
          parking_spaces (
            space_number,
            section,
            address
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (sessionsError) {
        console.warn('Error fetching sessions:', sessionsError);
      }

      // Fetch user payments
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (paymentsError) {
        console.warn('Error fetching payments:', paymentsError);
      }

      setUserDetails({
        profile,
        vehicles: vehicles || [],
        sessions: sessions || [],
        payments: payments || []
      });
    } catch (err) {
      console.error('Error fetching user details:', err);
      setError('Failed to fetch user details');
    } finally {
      setLoading(false);
    }
  };

  // Update user
  const updateUser = async () => {
    setError('');
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          email: formData.email,
          role: formData.role
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      // Refresh users list
      await fetchUsers();
      setShowEditModal(false);
      setSelectedUser(null);
      resetForm();
      
      // Log admin activity
      await logAdminActivity('update_user', `Updated user: ${formData.name} (${formData.email})`);
    } catch (err) {
      console.error('Error updating user:', err);
      setError(err.message || 'Failed to update user');
    }
  };

  // Delete user
  const deleteUser = async () => {
    setError('');
    
    try {
      // Delete auth user (this will cascade delete the profile due to foreign key)
      const { error: authError } = await supabase.auth.admin.deleteUser(userToDelete.id);
      
      if (authError) throw authError;

      // Refresh users list
      await fetchUsers();
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      
      // Log admin activity
      await logAdminActivity('delete_user', `Deleted user: ${userToDelete.name} (${userToDelete.email})`);
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err.message || 'Failed to delete user');
    }
  };

  // Log admin activity
  const logAdminActivity = async (action, details) => {
    try {
      await supabase
        .from('admin_activities')
        .insert([
          {
            admin_id: userProfile.id,
            action: action,
            details: details
          }
        ]);
    } catch (err) {
      console.warn('Failed to log admin activity:', err);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'user',
      password: ''
    });
  };

  // Open edit modal
  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      password: ''
    });
    setShowEditModal(true);
  };

  // Open details modal
  const openDetailsModal = async (user) => {
    setSelectedUser(user);
    await fetchUserDetails(user.id);
    setShowDetailsModal(true);
  };

  // Open delete confirmation
  const openDeleteConfirm = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  // Filter users based on search term
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Load users when modal opens
  useEffect(() => {
    if (show) {
      fetchUsers();
    }
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] border border-gray-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <h3 className="text-xl font-medium text-white">Manage Users</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-gray-800">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-900 border border-red-700 rounded-md">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Users Table */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Vehicles
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-900 divide-y divide-gray-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                        {searchTerm ? 'No users found matching your search.' : 'No users found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-800">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-white">{user.name}</div>
                            <div className="text-sm text-gray-400">{user.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'admin' 
                              ? 'bg-purple-900 text-purple-300' 
                              : 'bg-green-900 text-green-300'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {user.vehicleCount} vehicle{user.vehicleCount !== 1 ? 's' : ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                          {formatDate(user.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            onClick={() => openDetailsModal(user)}
                            className="text-blue-400 hover:text-blue-300"
                            title="View Details"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openEditModal(user)}
                            className="text-yellow-400 hover:text-yellow-300"
                            title="Edit User"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(user)}
                            className="text-red-400 hover:text-red-300"
                            title="Delete User"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60 p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-md w-full border border-gray-800">
            <div className="px-6 py-4 border-b border-gray-800">
              <h3 className="text-lg font-medium text-white">Edit User</h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedUser(null);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={updateUser}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                >
                  Update User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60 p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] border border-gray-800">
            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-lg font-medium text-white">User Details</h3>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              {userDetails.profile && (
                <div className="space-y-6">
                  {/* Profile Information */}
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <h4 className="text-lg font-medium text-white mb-3">Profile Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-400">Name</label>
                        <p className="text-white">{userDetails.profile.name}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Email</label>
                        <p className="text-white">{userDetails.profile.email}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Role</label>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          userDetails.profile.role === 'admin' 
                            ? 'bg-purple-900 text-purple-300' 
                            : 'bg-green-900 text-green-300'
                        }`}>
                          {userDetails.profile.role}
                        </span>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Joined</label>
                        <p className="text-white">{formatDate(userDetails.profile.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Vehicles */}
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <h4 className="text-lg font-medium text-white mb-3">Vehicles ({userDetails.vehicles.length})</h4>
                    {userDetails.vehicles.length === 0 ? (
                      <p className="text-gray-400">No vehicles registered</p>
                    ) : (
                      <div className="space-y-3">
                        {userDetails.vehicles.map((vehicle) => (
                          <div key={vehicle.id} className="bg-gray-700 p-3 rounded">
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <label className="text-xs text-gray-400">Plate Number</label>
                                <p className="text-white font-mono">{vehicle.vehicle_plate_number}</p>
                              </div>
                              <div>
                                <label className="text-xs text-gray-400">Type</label>
                                <p className="text-white capitalize">{vehicle.vehicle_type}</p>
                              </div>
                              <div>
                                <label className="text-xs text-gray-400">Model</label>
                                <p className="text-white">{vehicle.vehicle_model}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Parking Sessions */}
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <h4 className="text-lg font-medium text-white mb-3">Recent Parking Sessions ({userDetails.sessions.length})</h4>
                    {userDetails.sessions.length === 0 ? (
                      <p className="text-gray-400">No parking sessions</p>
                    ) : (
                      <div className="space-y-3">
                        {userDetails.sessions.map((session) => (
                          <div key={session.id} className="bg-gray-700 p-3 rounded">
                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <label className="text-xs text-gray-400">Space</label>
                                <p className="text-white">{session.parking_spaces?.space_number || 'N/A'}</p>
                              </div>
                              <div>
                                <label className="text-xs text-gray-400">Status</label>
                                <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                  session.status === 'completed' ? 'bg-green-900 text-green-300' :
                                  session.status === 'checked_in' ? 'bg-blue-900 text-blue-300' :
                                  session.status === 'cancelled' ? 'bg-red-900 text-red-300' :
                                  'bg-yellow-900 text-yellow-300'
                                }`}>
                                  {session.status}
                                </span>
                              </div>
                              <div>
                                <label className="text-xs text-gray-400">Amount</label>
                                <p className="text-white">₱{session.total_amount || '0.00'}</p>
                              </div>
                              <div>
                                <label className="text-xs text-gray-400">Date</label>
                                <p className="text-white text-xs">{formatDate(session.created_at)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Payments */}
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <h4 className="text-lg font-medium text-white mb-3">Recent Payments ({userDetails.payments.length})</h4>
                    {userDetails.payments.length === 0 ? (
                      <p className="text-gray-400">No payments</p>
                    ) : (
                      <div className="space-y-3">
                        {userDetails.payments.map((payment) => (
                          <div key={payment.id} className="bg-gray-700 p-3 rounded">
                            <div className="grid grid-cols-4 gap-4">
                              <div>
                                <label className="text-xs text-gray-400">Amount</label>
                                <p className="text-white">₱{payment.amount}</p>
                              </div>
                              <div>
                                <label className="text-xs text-gray-400">Method</label>
                                <p className="text-white">{payment.payment_method}</p>
                              </div>
                              <div>
                                <label className="text-xs text-gray-400">Status</label>
                                <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                  payment.status === 'completed' ? 'bg-green-900 text-green-300' :
                                  payment.status === 'failed' ? 'bg-red-900 text-red-300' :
                                  'bg-yellow-900 text-yellow-300'
                                }`}>
                                  {payment.status}
                                </span>
                              </div>
                              <div>
                                <label className="text-xs text-gray-400">Date</label>
                                <p className="text-white text-xs">{formatDate(payment.created_at)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60 p-4">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-md w-full border border-gray-800">
            <div className="px-6 py-4 border-b border-gray-800">
              <h3 className="text-lg font-medium text-white">Confirm Delete</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-300 mb-4">
                Are you sure you want to delete <strong>{userToDelete.name}</strong>? 
                This action cannot be undone and will remove all associated data including 
                vehicles, parking sessions, and payments.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setUserToDelete(null);
                  }}
                  className="px-4 py-2 bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteUser}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;
