<script setup>
const props = defineProps({ name: { type: String, default: 'github' }})
const animals = ["🐮","🐱","🐶","🐰","🌳","🌿","🌹","☀","🌙"]
const colors = [["#ffd9d0","#f3a99f"],["#ffe5b8","#f2c777"],["#e2f3c7","#bcd97f"],["#d8eef0","#9fd0d6"],["#e7def7","#c3b1ea"],["#dfe7ff","#b2c3f0"],["#ffd7e8","#f3a0c8"],["#fff2d0","#f0d880"],["#dae8ff","#a8c0f0"]]
const hash = Array.from(props.name).reduce((t,c) => t + c.charCodeAt(0), 0)
const animal = animals[hash % animals.length]
const bg = colors[hash % colors.length]
</script>
<template>
  <span class="git-badge" :style="{ background: 'linear-gradient(135deg,' + bg[0] + ',' + bg[1] + ')', color: 'white' }">{{ animal }}</span>
</template>
<style scoped>
.git-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  font-size: 18px;
  font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI Symbol', sans-serif;
  color: white;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.35);
  user-select: none;
  line-height: 1;
}
</style>