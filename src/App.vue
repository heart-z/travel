<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';
import { initialize } from './state';
onLaunch(() => { void initialize(); });
</script>
<style>
@import './styles.css';
@import './styles/ios-polish.css';
</style>
