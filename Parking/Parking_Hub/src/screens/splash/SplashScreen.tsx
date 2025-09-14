import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions, Text } from 'react-native';

const { width, height } = Dimensions.get('window');

const SplashScreen = ({ navigation }: { navigation: any }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Onboarding');
    }, 3000);

    return () => clearTimeout(timer);
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  brandNameContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  brandName: {
    fontSize: 53,
    color: '#FFD700',
    fontFamily: 'Raleway-ExtraBold',
    marginRight: 10,
  },
});

export default SplashScreen;