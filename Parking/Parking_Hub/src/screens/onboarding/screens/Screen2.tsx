import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import {
  createResponsiveStyles,
  scaledFont,
  scaledSpacing,
  getButtonHeight
} from '../../../utils/responsive';

interface Screen2Props {
  onNext: () => void;
  onSkip: () => void;
}

const Screen2: React.FC<Screen2Props> = ({ onNext, onSkip }) => {
  return (
    <View style={styles.container}>
      <Image 
        source={require('../../../../assets/images/backdrop/Onboarding 2-B.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <View style={styles.contentContainer}>
        <View style={styles.textContainer}>
          <View style={styles.iconContainer}>
             <Image 
              source={require('../../../../assets/images/icons/protect.png')}
              style={styles.protectIcon}
              resizeMode="contain"
            />
            <Text style={styles.title}>Assure Safe Parking</Text>
          </View>
          <Text style={styles.description}>Awesome <Text>🖐</Text> experience SafeCar Parking</Text>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextButton} onPress={onNext}>
            <Text style={styles.nextText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const createStyles = () => {
  const responsive = createResponsiveStyles();
  const buttonHeight = getButtonHeight();
  
  const skipButtonWidth = responsive.isSmallScreen ? 90 : responsive.isMediumScreen ? 105 : 115;
  const nextButtonWidth = responsive.isSmallScreen ? 150 : responsive.isMediumScreen ? 170 : 184;
  
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
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
      paddingBottom: scaledSpacing(40),
    },
    textContainer: {
      marginBottom: scaledSpacing(60),
    },
    iconContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: scaledSpacing(16),
    },
    protectIcon: {
      fontSize: scaledFont(24),
      color: '#FFFFFF',
      marginRight: scaledSpacing(10),
    },
    title: {
      fontFamily: 'Raleway-Light',
      fontSize: scaledFont(18),
      color: '#FFFFFF',
      marginLeft: scaledSpacing(10),
    },
    description: {
      fontFamily: 'Raleway-Regular',
      fontSize: scaledFont(33),
      color: '#FFFFFF',
      lineHeight: scaledFont(38),
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: responsive.padding,
      paddingBottom: scaledSpacing(40),
      width: '100%',
    },
    skipButton: {
      backgroundColor: '#FFFFFF',
      width: skipButtonWidth,
      height: buttonHeight + 20,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
    },
    skipText: {
      fontFamily: 'Raleway-Medium',
      color: '#000000',
      fontSize: scaledFont(20),
    },
    nextButton: {
      backgroundColor: '#FFD700',
      width: nextButtonWidth,
      height: buttonHeight + 20,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
    },
    nextText: {
      fontFamily: 'Raleway-Medium',
      color: '#000000',
      fontSize: scaledFont(20),
    },
  });
};

const styles = createStyles();

export default Screen2;