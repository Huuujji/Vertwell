import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,testMatch:['account-deletion.spec.ts','management.spec.ts'],workers:1,fullyParallel:false});
