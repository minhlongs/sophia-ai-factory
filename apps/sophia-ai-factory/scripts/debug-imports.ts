
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { Navbar } from '../src/app/components/layout/navbar';
import { QueryProvider } from '../src/components/providers/query-provider';
import { Button } from '../src/app/components/ui/button';

console.log('Checking imports...');
console.log('ThemeProvider type:', typeof ThemeProvider);
console.log('Toaster type:', typeof Toaster);
console.log('Navbar type:', typeof Navbar);
console.log('QueryProvider type:', typeof QueryProvider);
console.log('Button type:', typeof Button);

if (!ThemeProvider) console.error('FAIL: ThemeProvider is undefined');
if (!Toaster) console.error('FAIL: Toaster is undefined');
if (!Navbar) console.error('FAIL: Navbar is undefined');
if (!QueryProvider) console.error('FAIL: QueryProvider is undefined');
if (!Button) console.error('FAIL: Button is undefined');
