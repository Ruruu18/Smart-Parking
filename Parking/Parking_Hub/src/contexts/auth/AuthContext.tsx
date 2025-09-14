import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/supabase';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  register: (name: string, email: string, password: string) => Promise<AuthResult>;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  error: string | null;
  clearError: () => void;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthResult {
  success: boolean;
  message?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check for stored user on app load
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error loading user from storage:', error);
      }
    };
    
    loadUser();
  }, []);

  // SUPABASE REGISTER
  const register = async (name: string, email: string, password: string): Promise<AuthResult> => {
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return { success: false, message: signUpError.message };
      }

      if (!data.user) {
        setError('No user data returned from signup');
        return { success: false, message: 'No user data returned from signup' };
      }

      // Create user profile in the profiles table using UPSERT
      const profileData = {
        id: data.user.id,
        name: name,
        email: email,
        role: 'user'
      };
      
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert([profileData], { onConflict: 'id' });

      if (profileError) {
        setError(`Profile creation failed: ${profileError.message}`);
        return { success: false, message: `Profile creation failed: ${profileError.message}` };
      }

      return { success: true };
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      return { success: false, message: err.message || 'Registration failed' };
    }
  };

  // SUPABASE LOGIN
  const login = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !data.session) {
        const message = signInError?.message || 'Login failed';
        setError(message);
        return { success: false, message };
      }

      // Save user data locally (optional)
      const userData: User = {
        id: data.user.id,
        name: data.user.user_metadata?.full_name || '',
        email: data.user.email ?? '',
      };
      setUser(userData);
      await AsyncStorage.setItem('user', JSON.stringify(userData));

      return { success: true };
    } catch (err: any) {
      const message = err.message || 'Login failed';
      setError(message);
      return { success: false, message };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      await AsyncStorage.removeItem('user');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const clearError = () => {
    setError(null);
  };

  // Listen for auth state changes so app reacts to login/logout elsewhere
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const u: User = {
          id: session.user.id,
          name: session.user.user_metadata?.full_name || '',
          email: session.user.email ?? '',
        };
        setUser(u);
        await AsyncStorage.setItem('user', JSON.stringify(u));
      } else {
        setUser(null);
        await AsyncStorage.removeItem('user');
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        isAuthenticated: !!user, 
        register, 
        login, 
        logout, 
        error,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};