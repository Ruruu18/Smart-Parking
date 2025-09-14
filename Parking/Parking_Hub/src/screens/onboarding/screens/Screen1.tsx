import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

interface Screen1Props {
  onNext: () => void;
  onSkip: () => void;
}

const Screen1: React.FC<Screen1Props> = ({ onNext, onSkip }) => {
  return (
    <View style={styles.container}>
      <Image 
        source={require('../../../../assets/images/backdrop/Onboarding 2-A.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      <View style={styles.contentContainer}>
        <View style={styles.textContainer}>
          <View style={styles.iconContainer}>
            <Image 
              source={require('../../../../assets/images/icons/car.png')}
              style={styles.carIcon}
              resizeMode="contain"
            />
            <Text style={styles.title}>Car Parking</Text>
          </View>
          <Text style={styles.description}>You can feel best performance on your drive <Text>💪</Text></Text>
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

const styles = StyleSheet.create({
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  textContainer: {
    marginBottom: 60,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  carIcon: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  title: {
    fontFamily: 'Raleway-Light',
    fontSize: 18,
    color: '#FFFFFF',
    marginLeft: 10,
  },
  description: {
    fontFamily: 'Raleway-Regular',
    fontSize: 33,
    color: '#FFFFFF',
    lineHeight: 38,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    width: '100%',
  },
  skipButton: {
    backgroundColor: '#FFFFFF',
    width: 115,
    height: 73,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    fontFamily: 'Raleway-Medium',
    color: '#000000',
    fontSize: 20,
  },
  nextButton: {
    backgroundColor: '#FFD700',
    width: 184,
    height: 73,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextText: {
    fontFamily: 'Raleway-Medium',
    color: '#000000',
    fontSize: 20,
  },
});

export default Screen1;