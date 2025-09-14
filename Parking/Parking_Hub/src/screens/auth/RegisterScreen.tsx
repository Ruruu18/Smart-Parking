import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/auth/AuthContext';

type NavigationProps = {
  navigate: (screen: string) => void;
};

const RegisterScreen = () => {
  const navigation = useNavigation<NavigationProps>();
  const { register, error, clearError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    
    if (!agreeToTerms) {
      Alert.alert('Error', 'Please agree to the terms and conditions');
      return;
    }
    
    setIsLoading(true);
    clearError();
    
    try {
      const result = await register(name, email, password);
      
      if (result.success) {
        Alert.alert('Success', 'Registration successful! Please login.', [
          { text: 'OK', onPress: () => navigation.navigate('Login') }
        ]);
      } else {
        Alert.alert('Error', result.message || 'Registration failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginInstead = () => {
    navigation.navigate('Login');
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

          <Text style={styles.title}>Create your account</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="#666"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Enter email or phone"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Create password"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="password-new"
              passwordRules="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor="#666"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="password-new"
              passwordRules="none"
            />

            <View style={styles.termsRow}>
              <TouchableOpacity 
                style={styles.checkboxContainer}
                onPress={() => setAgreeToTerms(!agreeToTerms)}
              >
                <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]} />
                <Text style={styles.termsText}>I agree to the </Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.termsLink}>Terms and Conditions</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.registerButton} 
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.registerButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an Account? </Text>
              <TouchableOpacity onPress={handleLoginInstead}>
                <Text style={styles.loginLink}>Login</Text>
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
  termsRow: {
    flexDirection: 'row',
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
  termsText: {
    color: '#666',
    fontSize: 13,
    fontFamily: 'Raleway-Regular',
  },
  termsLink: {
    color: '#FFD700',
    fontSize: 13,
    fontFamily: 'Raleway-Regular',
  },
  registerButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: height * 0.03,
  },
  registerButtonText: {
    color: 'black',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Raleway-Bold',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Raleway-Regular',
  },
  loginLink: {
    color: '#FFD700',
    fontSize: 14,
    fontFamily: 'Raleway-Regular',
  },
  brandNameContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
});

export default RegisterScreen;