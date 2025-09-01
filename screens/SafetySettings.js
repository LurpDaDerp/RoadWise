import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Switch,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../utils/firebase';
import { ThemeContext } from '../context/ThemeContext';
import { saveTrustedContacts, getTrustedContacts } from '../utils/firestore';
import { Alert } from 'react-native';

const { width, height } = Dimensions.get('window');

const STORAGE_KEYS = {
  exampleToggle: '@exampleToggle',
};

export default function SafetySettings() {
  const { resolvedTheme } = useContext(ThemeContext);
  const isDark = resolvedTheme === 'dark';

  const backgroundColor = isDark ? '#0e0e0eff' : '#fff';
  const titleColor = isDark ? '#fff' : '#000';
  const textColor = isDark ? '#fff' : '#000';
  const itemBackground = isDark ? '#222' : '#fff';
  const inputBackgroundColor = isDark ? '#4b4b4bff' : '#ddddddff';
  const inputTextColor = isDark ? '#fff' : '#000';
  const closeButtonColor = isDark ? '#5e5e5eff' : '#a3a3a3ff';

  const [exampleToggle, setExampleToggle] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '' });

  const uid = auth.currentUser?.uid;

  const formatPhoneNumber = (value) => {
    if (!value) return value;
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (!match) return value;

    let formatted = '';
    if (match[1]) formatted = '(' + match[1];
    if (match[1]?.length === 3) formatted += ')-';
    if (match[2]) formatted += match[2];
    if (match[2]?.length === 3) formatted += '-';
    if (match[3]) formatted += match[3];

    return formatted;
  };

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const contacts = await getTrustedContacts(uid);
      setContacts(contacts);
    })();
  }, [uid]);

  useEffect(() => {
    if (showModal) setNewContact({ name: '', phone: '' });
  }, [showModal]);

  const handleAddContact = async () => {
    if (!newContact.name || !newContact.phone) {
      alert('Please fill in both name and phone number.');
      return;
    }

    const digitsOnlyPhone = newContact.phone.replace(/\D/g, '');
    if (digitsOnlyPhone.length !== 10) {
      alert('Please enter a valid 10-digit phone number.');
      return;
    }

    const existingContact = contacts.find(
      contact => contact.phone.replace(/\D/g, '') === digitsOnlyPhone
    );

    if (existingContact) {
      alert(`This number is already saved as "${existingContact.name || 'Unnamed'}".`);
      return;
    }

    const updated = [...contacts, newContact];
    setContacts(updated);
    await saveTrustedContacts(uid, updated);
    setNewContact({ name: '', phone: '' });
    setShowModal(false);
  };

  const removeContact = (indexToRemove) => {
    const contact = contacts[indexToRemove];
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete "${contact.name || 'Unnamed'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            const updated = contacts.filter((_, index) => index !== indexToRemove);
            setContacts(updated);
            await saveTrustedContacts(uid, updated);
          } 
        },
      ],
      { cancelable: true }
    );
  };

  const toggleExample = async (value) => {
    setExampleToggle(value);
    await AsyncStorage.setItem(STORAGE_KEYS.exampleToggle, value.toString());
  };

  return (
    <ScrollView style={[styles.background, { backgroundColor }]}>
      <View style={styles.overlay}>
        <Text style={[styles.title, { color: titleColor }]}>Safety Settings</Text>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: textColor }]}>Trusted Contacts</Text>
          <FlatList
            data={contacts}
            keyExtractor={(_, index) => index.toString()}
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <View style={[styles.contactItem, { backgroundColor: itemBackground }]}>
                <Text style={[styles.contactText, { color: textColor }]}>
                  {item.name || 'Unnamed'}: {formatPhoneNumber(item.phone)}
                </Text>
                <TouchableOpacity onPress={() => removeContact(index)}>
                  <Ionicons name="trash" size={20} color="red" />
                </TouchableOpacity>
              </View>
            )}
          />
          <TouchableOpacity onPress={() => setShowModal(true)} style={styles.addButton}>
            <Text style={styles.addButtonText}>Add Trusted Contact</Text>
          </TouchableOpacity>

          <Modal
            animationType="fade"
            transparent={true}
            visible={showModal}
            onRequestClose={() => setShowModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: itemBackground }]}>
                <Text style={[styles.modalTitle, { color: textColor }]}>Add Trusted Contact</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBackgroundColor, color: inputTextColor, fontSize: 14 }]}
                  placeholder="Name"
                  placeholderTextColor={isDark ? '#ccc' : '#999'}
                  value={newContact.name}
                  onChangeText={(text) => setNewContact({ ...newContact, name: text })}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: inputBackgroundColor, color: inputTextColor, fontSize: 14 }]}
                  placeholder="Phone Number"
                  placeholderTextColor={isDark ? '#ccc' : '#999'}
                  keyboardType="phone-pad"
                  value={newContact.phone}
                  onChangeText={(text) => setNewContact({ ...newContact, phone: text })}
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity onPress={() => setShowModal(false)} style={[styles.modalButton, { backgroundColor: closeButtonColor }]}>
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleAddContact} style={styles.modalButton}>
                    <Text style={styles.modalButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>

        <View style={styles.settingRowToggle}>
          <Text style={[styles.settingLabel, { color: textColor }]}>Notify Contacts</Text>
          <Switch
            value={exampleToggle}
            onValueChange={toggleExample}
            trackColor={{ false: '#767577', true: '#86ff7d' }}
            thumbColor={exampleToggle ? '#ffffff' : '#f4f3f4'}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, padding: width / (375 / 24) },
  title: {
    fontSize: width / (375 / 32),
    fontWeight: 'bold',
    marginTop: height / (667 / 60),
    marginBottom: height / (667 / 32),
    alignSelf: 'center',
  },
  settingRow: { marginBottom: width / (375 / 16) },
  settingRowToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: width / (375 / 16),
  },
  settingLabel: {
    fontSize: width / (375 / 16),
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  contactText: {
    fontSize: width / (375 / 16),
  },
  addButton: {
    backgroundColor: '#7700ffff',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    borderRadius: width / (375 / 14),
    padding: width / (375 / 20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: width / (375 / 20),
    fontWeight: '600',
    marginBottom: height / (667 / 16),
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: height / (667 / 14),
  },
  modalButton: {
    backgroundColor: '#7700ffff',
    paddingVertical: height / (667 / 10),
    paddingHorizontal: width / (375 / 20),
    borderRadius: width / (375 / 10),
    flex: 1,
    alignItems: 'center',
    marginHorizontal: width / (375 / 5), 
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  input: {
    paddingVertical: height / (667 / 10),
    paddingHorizontal: width / (375 / 12),
    borderRadius: width / (375 / 10),
    marginBottom: height / (667 / 12),
  },
});
