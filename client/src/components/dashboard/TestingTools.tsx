import { useState, memo } from 'react';
import { Card } from '../ui/Card';
import { CopyButton } from '../ui/CopyButton';
import { Button } from '../ui/Button';
import { Droplets, Coins, Wifi, WifiOff, ExternalLink } from 'lucide-react';

interface TestingToolsProps {
  contractAddresses: { token: string; staking: string; swap: string };
  networkStatus: 'connected' | 'disconnected';
  requestFaucet: () => Promise<string>;
  mintTestTokens: () => Promise<string>;
}

export const TestingTools = memo(function TestingTools({ contractAddresses, networkStatus, requestFaucet, mintTestTokens }: TestingToolsProps) {
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);
  const [mintMsg, setMintMsg] = useState<string | null>(null);
  const [loadingFaucet, setLoadingFaucet] = useState(false);
  const [loadingMint, setLoadingMint] = useState(false);

  const handleFaucet = async () => {
    setLoadingFaucet(true);
    const msg = await requestFaucet();
    setFaucetMsg(msg);
    setLoadingFaucet(false);
    setTimeout(() => setFaucetMsg(null), 3000);
  };

  const handleMint = async () => {
    setLoadingMint(true);
    const msg = await mintTestTokens();
    setMintMsg(msg);
    setLoadingMint(false);
    setTimeout(() => setMintMsg(null), 3000);
  };

  return (
    <Card id="tools" className="border-white/10">
      <h3 className="text-xl font-display font-bold text-white mb-6">Testing Tools</h3>

      {/* Network Status */}
      <div className="flex items-center gap-3 bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5 mb-6">
        {networkStatus === 'connected' ? (
          <Wifi className="w-5 h-5 text-[var(--color-success)]" />
        ) : (
          <WifiOff className="w-5 h-5 text-[var(--color-error)]" />
        )}
        <div>
          <p className="text-sm font-semibold text-white">
            {networkStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">Ethereum Sepolia Testnet (Chain ID: 11155111)</p>
        </div>
        <div className={`ml-auto w-2.5 h-2.5 rounded-full ${networkStatus === 'connected' ? 'bg-[var(--color-success)] animate-pulse' : 'bg-[var(--color-error)]'}`} />
      </div>

      {/* Faucet & Mint */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <Button onClick={handleFaucet} isLoading={loadingFaucet} variant="outline" className="w-full gap-2">
            <Droplets className="w-4 h-4" /> Request Test ETH
          </Button>
          {faucetMsg && <p className="text-xs text-[var(--color-success)] text-center">{faucetMsg}</p>}
          <a 
            href="https://sepoliafaucet.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary-light)] transition-colors"
          >
            Sepolia Faucet <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="space-y-2">
          <Button onClick={handleMint} isLoading={loadingMint} variant="outline" className="w-full gap-2">
            <Coins className="w-4 h-4" /> Mint Test WDFI
          </Button>
          {mintMsg && <p className="text-xs text-[var(--color-success)] text-center">{mintMsg}</p>}
        </div>
      </div>

      {/* Contract Addresses */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-[var(--color-text-muted)]">Contract Addresses</h4>
        {Object.entries(contractAddresses).map(([name, addr]) => (
          <div key={name} className="flex items-center justify-between bg-[var(--color-bg)]/50 rounded-lg p-3 border border-white/5">
            <div>
              <p className="text-xs text-[var(--color-text-muted)] capitalize">{name}</p>
              <code className="text-xs text-white">{addr.slice(0, 10)}...{addr.slice(-8)}</code>
            </div>
            <CopyButton text={addr} />
          </div>
        ))}
      </div>
    </Card>
  );
});
