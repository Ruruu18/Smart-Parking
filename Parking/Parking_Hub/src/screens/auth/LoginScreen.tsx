import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, Dimensions, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/auth/AuthContext';

type NavigationProps = {
  navigate: (screen: string) => void;
  reset: (options: { index: number; routes: { name: string }[] }) => void;
};

const LoginScreen = () => {
  const navigation = useNavigation<NavigationProps>();
  const { login, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    setIsLoading(true);
    clearError();
    
    try {
      const result = await login(email, password);
      
      if (result.success) {
        console.log('Login successful');
        // Navigate to home screen
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }]
        });
      } else {
        Alert.alert('Error', result.message || 'Login failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = () => {
    navigation.navigate('Register');
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.logoWrapper}>
          <View style={styles.logo}>
            <Image 
              source={require('../../../assets/images/icons/wheel.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.brandNameContainer}>
            <Text style={styles.brandName}>Parking</Text>
            <Text style={styles.brandName}>Hub</Text>
          </View>
        </View>

        <Text style={styles.title}>Login to your account</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Enter email or phone"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <View style={styles.rememberMeRow}>
            <TouchableOpacity 
              style={styles.checkboxContainer}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]} />
              <Text style={styles.rememberMeText}>Remember me</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.forgotPassword}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            {isLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signUpRow}>
            <Text style={styles.signUpText}>Don't have an Account? </Text>
            <TouchableOpacity onPress={handleCreateAccount}>
              <Text style={styles.signUpLink}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    paddingHorizontal: width * 0.06,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: height * 0.06,
  },
  logoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 183,
    height: 183,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    overflow: 'hidden'
  },
  logoImage: {
    width: '100%',
    height: '100%'
  },
  brandName: {
    fontSize: 53,  
    color: '#FFD700',
    fontFamily: 'Raleway-ExtraBold',
    marginRight: 10,
  },
  title: {
    fontSize: width * 0.055,
    marginBottom: height * 0.035,
    color: 'white',
    fontFamily: 'Raleway-Regular',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  input: {
    width: '100%',
    height: 50,
    paddingHorizontal: width * 0.04,
    marginBottom: height * 0.02,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    backgroundColor: 'transparent',
    color: 'white',
    fontSize: width * 0.038,
    fontFamily: 'Raleway-Regular',
  },
  rememberMeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: height * 0.03,
    paddingHorizontal: 4,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 4,
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  rememberMeText: {
    color: '#666',
    fontSize: 13,
    fontFamily: 'Raleway-Regular',
  },
  forgotPassword: {
    color: '#FFD700',
    fontSize: 13,
    fontFamily: 'Raleway-Regular',
  },
  loginButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: height * 0.03,
  },
  loginButtonText: {
    color: 'black',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Raleway-Bold',
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Raleway-Regular',
  },
  signUpLink: {
    color: '#FFD700',
    fontSize: 14,
    fontFamily: 'Raleway-Regular',
  },
  brandNameContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
});

export default LoginScreen;