import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Pocket Ledger · Your money, in focus',description:'Private personal finances, clear spending and purposeful savings.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,statusBarStyle:'default',title:'Pocket Ledger'},icons:{icon:'/icon.svg',apple:'/icon-192.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><meta name="theme-color" content="#143e36"/><script dangerouslySetInnerHTML={{__html:`try{document.documentElement.dataset.theme=localStorage.getItem('pocket-theme')||'light'}catch{}`}}/></head><body>{children}</body></html>}
