import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { getLogoSize, getBrandNameFontSize, createResponsiveStyles } from '../../utils/responsive';

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