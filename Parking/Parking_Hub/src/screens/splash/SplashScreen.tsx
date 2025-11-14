import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../supabase';
import { getLogoSize, getBrandNameFontSize, createResponsiveStyles } from '../../utils/responsive';

const SplashScreen = ({ navigation }: { navigation: any }) => {
  useEffect(() => {
    const checkAuthAndNavigate = async () => {
      try {
        // Wait for splash screen display (3 seconds)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check if onboarding was completed
        const onboardingCompleted = await AsyncStorage.getItem('onboardingCompleted');

        // Check if user has active session
        const { data: { session } } = await supabase.auth.getSession();

        console.log('Navigation check:', {
          onboardingCompleted,
          hasSession: !!session
        });

        // Navigate based on state (prioritize session over onboarding)
        if (session?.user) {
          // User has active session - go directly to Home (auto-login)
          console.log('Navigating to Home (logged in - auto-login)');
          // Also mark onboarding as completed if not already
          if (!onboardingCompleted) {
            await AsyncStorage.setItem('onboardingCompleted', 'true');
          }
          navigation.replace('Home');
        } else if (!onboardingCompleted) {
          // First time user - show onboarding
          console.log('Navigating to Onboarding (first time)');
          navigation.replace('Onboarding');
        } else {
          // Onboarding done but not logged in - show Login
          console.log('Navigating to Login');
          navigation.replace('Login');
        }
      } catch (error) {
        console.error('Error checking auth state:', error);
        // On error, show onboarding as fallback
        navigation.replace('Onboarding');
      }
    };

    checkAuthAndNavigate();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.logoWrapper}>
          <View style={styles.logo}>
            <Image 
              source={require('../../../assets/images/gif/wheel-move.gif')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.brandNameContainer}>
            <Text style={styles.brandName}>Parking</Text>
            <Text style={styles.brandName}>Hub</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const createStyles = () => {
  const responsive = createResponsiveStyles();
  const logoSize = getLogoSize();
  const brandNameFontSize = getBrandNameFontSize();
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    contentContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: responsive.padding,
    },
    logoWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logo: {
      width: logoSize.width,
      height: logoSize.height,
      backgroundColor: '#000',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: responsive.isSmallScreen ? 10 : 15,
      overflow: 'hidden'
    },
    logoImage: {
      width: '100%',
      height: '100%'
    },
    brandNameContainer: {
      flexDirection: 'column',
      alignItems: 'flex-start',
    },
    brandName: {
      fontSize: brandNameFontSize,
      color: '#FFD700',
      fontFamily: 'Raleway-ExtraBold',
      marginRight: responsive.isSmallScreen ? 5 : 10,
      lineHeight: brandNameFontSize * 1.1,
    },
  });
};

const styles = createStyles();

export default SplashScreen;