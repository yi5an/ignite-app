import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="all" />
      <Tabs.Screen name="achievements" />
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
