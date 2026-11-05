<script setup>
import { ref } from "vue";
import { FloatingAIChat } from "@farming-labs/nuxt-theme";
const style = ref("panel");
const visible = ref(true);
</script>
<template>
  <select v-model="style" aria-label="Chat style">
    <option v-for="value in ['panel', 'modal', 'popover', 'full-modal']" :key="value">{{ value }}</option>
  </select>
  <button @click="visible = !visible">Toggle chat mount</button>
  <FloatingAIChat v-if="visible" :key="style" :floating-style="style" />
</template>
