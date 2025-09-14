import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

const AddNewParking = ({ show, onClose, onAdded }) => {
  const { user, userProfile } = useAuth();

  const [category, setCategory] = useState('car');
  const [section, setSection] = useState('');
  const [address, setAddress] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successData, setSuccessData] = useState(null);

  if (!show) return null;

  const resetForm = () => {
    setCategory('car');
    setSection('');
    setAddress('');
    setDailyRate('');
    setError('');
    setSuccess('');
    setIsSubmitting(false);
    setShowSuccessAlert(false);
    setSuccessData(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError('');
    setSuccess('');

    if (!category || !section || !address || !dailyRate) {
      setError('All fields are required');
      return;
    }

    const rate = parseFloat(dailyRate);
    if (isNaN(rate) || rate <= 0) {
      setError('Daily rate must be a valid positive number');
      return;
    }

    try {
      if (userProfile?.role !== 'admin') {
        throw new Error('You do not have permission to add parking spaces.');
      }

      setIsSubmitting(true);

      // Determine new space number prefix (take last word / letter after space)
      const prefix = section.split(' ').pop()?.charAt(0).toUpperCase() || 'X';

      // Get current count to generate sequential number
      const { data: spaces } = await supabase
        .from('parking_spaces')
        .select('id')
        .like('space_number', `${prefix}-%`);

      const newNumber = String((spaces?.length || 0) + 1).padStart(2, '0');
      const newSpaceNumber = `${prefix}-${newNumber}`;

      // Check if already exists
      const { data: existing } = await supabase
        .from('parking_spaces')
        .select('id')
        .eq('space_number', newSpaceNumber)
        .limit(1);

      if (existing && existing.length) {
        throw new Error(`Space ${newSpaceNumber} already exists.`);
      }

      // Insert
      const { error: insertError } = await supabase.from('parking_spaces').insert([
        {
          space_number: newSpaceNumber,
          category,
          section,
          address,
          daily_rate: rate,
          is_occupied: false,
        },
      ]);

      if (insertError) throw insertError;

      // Log admin activity (best-effort)
      await supabase.from('admin_activities').insert([
        {
          admin_id: user.id,
          action: 'Added Parking Space',
          details: `Added new parking space ${newSpaceNumber} (${category}) in ${section} at ${address}`,
          created_at: new Date().toISOString() // Explicitly set timestamp
        },
      ]);

      setSuccess(`Space ${newSpaceNumber} added successfully!`);
      
      // Show custom success alert
      setSuccessData({
        spaceNumber: newSpaceNumber,
        address,
        category: category.charAt(0).toUpperCase() + category.slice(1),
        rate
      });
      setShowSuccessAlert(true);

      if (onAdded) onAdded();
    } catch (err) {
      console.error('Error adding space', err);
      setError(err.message || 'Failed to add space');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessAlert(false);
    resetForm();
    onClose();
  };

  // Success Alert Modal
  if (showSuccessAlert && successData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-xl shadow-2xl max-w-sm w-full border border-gray-800">
          <div className="p-8 text-center">
            {/* Success Icon */}
            <div className="w-16 h-16 mx-auto mb-6 bg-green-900 bg-opacity-30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-semibold text-white mb-2">
              Space Created
            </h3>
            
            {/* Space Details */}
            <div className="text-gray-400 mb-6">
              <div className="text-2xl font-bold text-white mb-1">
                {successData.spaceNumber}
              </div>
              <div className="text-sm">
                {successData.category} • ₱{successData.rate}/day
              </div>
            </div>
            
            {/* Action Button */}
            <button
              onClick={handleSuccessClose}
              className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-md w-full border border-gray-800">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <h3 className="text-lg font-medium text-white">Add New Parking Space</h3>
          <button onClick={() => { resetForm(); onClose(); }} className="text-gray-400 hover:text-white">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-400 mb-1">Category</label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="car">Car</option>
                <option value="truck">Truck</option>
                <option value="van">Van</option>
                <option value="pickup">Pickup</option>
                <option value="bike">Bike</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="scooter">Scooter</option>
              </select>
            </div>
            <div>
              <label htmlFor="section" className="block text-sm font-medium text-gray-400 mb-1">Section</label>
              <input
                type="text"
                id="section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. Section A"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-400 mb-1">Address</label>
              <input
                type="text"
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 123 Main St, City"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label htmlFor="daily_rate" className="block text-sm font-medium text-gray-400 mb-1">Daily Rate (₱)</label>
              <input
                type="number"
                id="daily_rate"
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            {error && (
              <div className="bg-red-900 border border-red-500 text-red-200 px-4 py-3 rounded relative">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
              </div>
            )}

          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => { resetForm(); onClose(); }}
              className="mr-3 px-4 py-2 bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Adding…' : 'Add Space'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddNewParking;