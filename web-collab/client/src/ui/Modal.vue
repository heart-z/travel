<script setup lang="ts">
import{ref,onMounted}from'vue';import Icon from'./Icon.vue';defineProps<{title:string;wide?:boolean}>();const emit=defineEmits<{close:[]}>();const el=ref<HTMLDialogElement>();onMounted(()=>el.value?.showModal());
</script>
<template><Teleport to="body"><dialog ref="el" :class="['modal',{wide}]" @cancel.prevent="emit('close')"><header><h2>{{title}}</h2><button class="icon-button" aria-label="关闭" @click="emit('close')"><Icon name="close"/></button></header><div class="modal-body"><slot/></div></dialog></Teleport></template>
