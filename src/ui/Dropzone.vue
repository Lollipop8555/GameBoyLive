<script setup lang="ts">
import { t } from '../i18n'

defineProps<{ active: boolean }>()
</script>

<template>
  <div class="dropzone" :class="{ active }" aria-hidden="true">
    <div class="dropzone__card">
      <span class="dropzone__icon">＋</span>
      <p>{{ t('drop.release') }}</p>
      <span class="dropzone__types">.gba · .gb · .gbc · .zip</span>
    </div>
  </div>
</template>

<style scoped>
.dropzone {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  background: rgba(10, 12, 16, 0.62);
  backdrop-filter: blur(3px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 140ms ease;
}

.dropzone.active {
  opacity: 1;
}

.dropzone__card {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 26px 40px;
  border: 2px dashed var(--accent);
  border-radius: 18px;
  background: rgba(28, 31, 40, 0.9);
  text-align: center;
}

.dropzone__icon {
  font-size: 26px;
  line-height: 1;
  color: var(--accent);
}

.dropzone__card p {
  margin: 0;
  font-weight: 600;
}

.dropzone__types {
  font: 11.5px / 1 ui-monospace, monospace;
  color: var(--text-dim);
}
</style>
