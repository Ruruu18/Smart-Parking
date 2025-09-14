import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../../supabase';
import { useAuth } from '../auth/AuthContext';

export interface Vehicle {
  id: string;
  user_id: string;
  vehicle_type: 'car' | 'truck' | 'van' | 'pickup' | 'bike' | 'motorcycle' | 'scooter';
  vehicle_model: string;
  vehicle_plate_number: string;
  created_at?: string;
  updated_at?: string;
}

interface VehicleContextState {
  vehicles: Vehicle[];
  refresh: () => Promise<void>;
  addVehicle: (v: Omit<Vehicle, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<string | null>;
  updateVehicle: (id: string, v: Partial<Omit<Vehicle, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<boolean>;
  deleteVehicle: (id: string) => Promise<boolean>;
}

const VehicleContext = createContext<VehicleContextState | undefined>(undefined);

export const VehicleProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const refresh = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching vehicles:', error);
    } else {
      setVehicles(data as Vehicle[]);
    }
  };

  const addVehicle = async (v: Omit<Vehicle, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('vehicles')
      .insert([{ ...v, user_id: user.id }])
      .select()
      .single();
    if (error) {
      console.error('Error adding vehicle:', error);
      return null;
    }
    return data?.id ?? null;
  };

  const updateVehicle = async (id: string, v: Partial<Omit<Vehicle, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    if (!user) return false;
    const { error } = await supabase
      .from('vehicles')
      .update(v)
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) {
      console.error('Error updating vehicle:', error);
      return false;
    }
    return true;
  };

  const deleteVehicle = async (id: string) => {
    if (!user) return false;
    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) {
      console.error('Error deleting vehicle:', error);
      return false;
    }
    return true;
  };

  // initial load
  useEffect(() => {
    if (!user) {
      setVehicles([]);
      return;
    }
    refresh();

    const channel = supabase
      .channel('public:vehicles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles', filter: `user_id=eq.${user.id}` }, () => {
        refresh();
      })
      .subscribe();
    return () => {
      // Remove channel; we ignore the returned promise to keep the cleanup sync
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <VehicleContext.Provider value={{ vehicles, refresh, addVehicle, updateVehicle, deleteVehicle }}>
      {children}
    </VehicleContext.Provider>
  );
};

export const useVehicles = () => {
  const ctx = useContext(VehicleContext);
  if (!ctx) throw new Error('useVehicles must be used within VehicleProvider');
  return ctx;
};
