import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {DrawerNavigationProp} from '@react-navigation/drawer';

interface Props {
  navigation: DrawerNavigationProp<any, 'HomeTab'>;
}

const HomeScreen: React.FC<Props> = ({navigation}) => {
  const canGoBack = navigation.canGoBack ? navigation.canGoBack() : false;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {canGoBack ? (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => navigation.openDrawer()}>
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Home</Text>
        <View style={{width: 40}} />
      </View>

      <View style={styles.content}>
        <Text style={styles.welcomeText}>Welcome Home!</Text>
        <Text style={styles.subtitle}>Farmer Onboarding Portal</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 28,
    color: '#3478f6',
  },
  backIcon: {
    fontSize: 28,
    color: '#3478f6',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});

export default HomeScreen;
