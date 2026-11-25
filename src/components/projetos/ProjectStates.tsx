import { Button } from '@/components/ui/button';
import { AlertCircle,RotateCcw } from 'lucide-react';
export function ProjectPending(){return <p role="status" className="py-10 text-center text-sm text-muted-foreground">Carregando projetos…</p>}
export function ProjectError({error,reset}:{error:unknown;reset:()=>void}){return <div role="alert" className="space-y-4 py-8"><AlertCircle className="h-6 w-6 text-destructive"/><h1 className="text-xl font-semibold">Não foi possível abrir esta página</h1><p className="text-sm text-muted-foreground">{error instanceof Error?error.message:'Tente novamente em instantes.'}</p><Button onClick={reset}><RotateCcw/>Tentar novamente</Button></div>}
