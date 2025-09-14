import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  createResponsiveStyles,
  scaledFont,
  scaledSpacing,
  getButtonHeight
} from '../../../utils/responsive';

interface Screen3Props {
  onNext: () => void;
  onSkip: () => void;
}

type NavigationProps = {
  navigate: (screen: string) => void;
};

const Screen3: React.FC<Screen3Props> = ({ onSkip }) => {
  const navigation = useNavigation<NavigationProps>();
  return (
    <View style={styles.container}>
      <View style={styles.backgroundImage}>
        <Image 
          source={require('../../../../assets/images/backdrop/Onboarding 2-C.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
        <View style={styles.contentContainer}>
          <View style={styles.headerContainer}>
            <Image 
              source={require('../../../../assets/images/icons/member.png')}
              style={[styles.memberIcon, { tintColor: '#FF0000' }]}
            />
            <Text style={styles.title}>Become a Member</Text>
          </View>
          <Text style={styles.description}>Create Account to book and manages the parking facilities at <Text style={styles.highlightText}>Parking Hub</Text></Text>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.getButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.getText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const createStyles = () => {
  const responsive = createResponsiveStyles();
  const buttonHeight = getButtonHeight();
  
  const getButtonWidth = responsive.isSmallScreen ? 160 : responsive.isMediumScreen ? 180 : 201;
  const iconSize = responsive.isSmallScreen ? 38 : responsive.isMediumScreen ? 42 : 45;
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    backgroundImage: {
      position: 'absolute',
      width: '100%',
      height: '100%',
    },
    contentContainer: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: responsive.padding,
      paddingBottom: scaledSpacing(60),
    },
    iconContainer: {
      marginBottom: scaledSpacing(15),
    },
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: scaledSpacing(15),
    },
    memberIcon: {
      width: iconSize,
      height: iconSize,
      resizeMode: 'contain',
      marginRight: scaledSpacing(10),
    },
    title: {
      fontFamily: 'Raleway-Light',
      fontSize: scaledFont(18),
      color: '#fff',
    },
    description: {
      fontFamily: 'Raleway-Regular',
      fontSize: scaledFont(38),
      color: '#fff',
      lineHeight: scaledFont(38),
    },
    highlightText: {
      fontFamily: 'Raleway-ExtraBold',
      color: '#FFD700',
    },
    buttonContainer: {
      paddingHorizontal: responsive.padding,
      paddingBottom: scaledSpacing(70),
      alignItems: 'center', 
    },
    getButton: {
      backgroundColor: '#FFD700',
      width: getButtonWidth,
      height: buttonHeight + 5,
      borderRadius: 15,
      justifyContent: 'center', 
      alignItems: 'center', 
    },
    getText: {
      color: '#000',
      fontSize: scaledFont(20),
      fontFamily: 'Raleway-SemiBold',
      textAlign: 'center',
    },
  });
};

const styles = createStyles();

export default Screen3;