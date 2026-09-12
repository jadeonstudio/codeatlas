#!/usr/bin/env node
import {main} from '../src/cli.mjs';
main().catch(e=>{console.error(JSON.stringify({error:e.message,status:e.status??500}));process.exitCode=1;});
