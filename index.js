import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';
import App from './App';

LogBox.ignoreLogs([
  'Failed to read text file',
  'readAsStringAsync',
  'Calling the \'readAsStringAsync\' function has failed'
]);

registerRootComponent(App);
