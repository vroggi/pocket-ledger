import React from 'react';
import {createRoot} from 'react-dom/client';
import Ledger from '../app/ui';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(<Ledger/>);
