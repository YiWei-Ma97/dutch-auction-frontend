
import React from 'react'

export default function Header() {
  return (
    <header style={{position:'sticky',top:0,backdropFilter:'blur(6px)',background:'rgba(8,13,20,0.7)',borderBottom:'1px solid #1f2630',zIndex:10}}>
      <div style={{maxWidth:1000,margin:'0 auto',padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',gap:12,alignItems:'center'}}>
          <div style={{width:10,height:10,borderRadius:999,background:'#7ee787'}}/>
          <strong>Dutch Auction • Sepolia</strong>
        </div>
        <a href="https://sepolia.etherscan.io" target="_blank" rel="noreferrer" style={{fontSize:13,opacity:.8,color:'#9ba7b4'}}>Etherscan</a>
      </div>
    </header>
  )
}
