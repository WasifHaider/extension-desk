<script setup lang="ts">
import { onMounted, ref } from 'vue';

interface Booking {
  id: string;
  source: string;
  status: string;
  startAt: string;
  endAt: string;
  vehicle: { name: string };
  renter: { name: string } | null;
}

const bookings = ref<Booking[]>([]);

onMounted(async () => {
  const res = await fetch('/api/bookings');
  bookings.value = await res.json();
});
</script>

<template>
  <h1>Extension Desk</h1>
  <h2>Seeded bookings</h2>
  <table>
    <thead>
      <tr>
        <th>Vehicle</th>
        <th>Renter</th>
        <th>Source</th>
        <th>Status</th>
        <th>Start</th>
        <th>End</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="b in bookings" :key="b.id">
        <td>{{ b.vehicle.name }}</td>
        <td>{{ b.renter?.name ?? 'Turo guest' }}</td>
        <td>{{ b.source }}</td>
        <td>{{ b.status }}</td>
        <td>{{ new Date(b.startAt).toLocaleString() }}</td>
        <td>{{ new Date(b.endAt).toLocaleString() }}</td>
      </tr>
    </tbody>
  </table>
</template>
