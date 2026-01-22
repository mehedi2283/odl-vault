import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Folder as FolderType, StoredCredential, FormDefinition } from '../types';
import { Folder, FileText, Lock, Database } from 'lucide-react';

interface NetworkGraphProps {
  folders: FolderType[];
  credentials: StoredCredential[];
  forms: FormDefinition[];
  onFolderClick: (id: string | null) => void;
  onItemClick: (id: string, type: 'credential' | 'form') => void;
  currentFolderId: string | null;
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({ 
  folders, 
  credentials, 
  forms, 
  onFolderClick,
  onItemClick,
  currentFolderId 
}) => {
  // Simple layout algorithm for a radial/tree view centered on current folder
  const layout = useMemo(() => {
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    const nodes: any[] = [];
    const links: any[] = [];

    // Root Node (Current Context)
    const currentFolder = folders.find(f => f.id === currentFolderId);
    nodes.push({
      id: currentFolderId || 'root',
      type: 'root',
      label: currentFolder ? currentFolder.name : 'Vault Root',
      x: centerX,
      y: centerY,
      r: 40
    });

    // Children Nodes (Subfolders)
    const subFolders = folders.filter(f => f.parentId === currentFolderId);
    const items = [...credentials.filter(c => c.folderId === currentFolderId), ...forms.filter(f => f.folderId === currentFolderId)];
    
    const totalChildren = subFolders.length + items.length;
    const radius = 200;
    const angleStep = (2 * Math.PI) / (totalChildren || 1);

    let index = 0;

    // Place Subfolders
    subFolders.forEach((folder) => {
       const angle = index * angleStep;
       const x = centerX + radius * Math.cos(angle);
       const y = centerY + radius * Math.sin(angle);
       
       nodes.push({
         id: folder.id,
         type: 'folder',
         label: folder.name,
         x, y, r: 25
       });
       links.push({ source: currentFolderId || 'root', target: folder.id });
       index++;
    });

    // Place Items
    items.forEach((item) => {
        const angle = index * angleStep;
        // Add some randomness to orbit for organic feel
        const itemRadius = radius + (Math.random() * 40 - 20); 
        const x = centerX + itemRadius * Math.cos(angle);
        const y = centerY + itemRadius * Math.sin(angle);
        
        const isCred = 'clientName' in item;
        nodes.push({
          id: item.id,
          type: isCred ? 'credential' : 'form',
          label: isCred ? (item as StoredCredential).clientName : (item as FormDefinition).name,
          x, y, r: 15,
          subLabel: isCred ? (item as StoredCredential).serviceName : 'Form'
        });
        links.push({ source: currentFolderId || 'root', target: item.id });
        index++;
    });

    return { nodes, links };
  }, [folders, credentials, forms, currentFolderId]);

  return (
    <div className="w-full h-[600px] bg-zinc-950 rounded-2xl border border-zinc-800 relative overflow-hidden shadow-inner flex items-center justify-center">
        {/* Background Grid */}
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-20 pointer-events-none"></div>

        {layout.nodes.length === 1 && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                 <div className="translate-y-24 text-zinc-700 text-[10px] font-mono animate-pulse bg-zinc-900/80 px-4 py-1.5 rounded-full border border-zinc-800/50">NO_NODES_DETECTED</div>
             </div>
        )}

        <svg className="w-full h-full relative z-10" viewBox="0 0 800 600">
           {/* Links */}
           <g className="links">
              {layout.links.map((link, i) => {
                 const source = layout.nodes.find(n => n.id === link.source);
                 const target = layout.nodes.find(n => n.id === link.target);
                 if(!source || !target) return null;

                 return (
                    <motion.line 
                       key={`${link.source}-${link.target}`}
                       x1={source.x} y1={source.y} x2={target.x} y2={target.y}
                       stroke="#3f3f46"
                       strokeWidth="1"
                       initial={{ pathLength: 0, opacity: 0 }}
                       animate={{ pathLength: 1, opacity: 0.5 }}
                       transition={{ duration: 0.5, delay: i * 0.05 }}
                    />
                 );
              })}
           </g>

           {/* Nodes */}
           {layout.nodes.map((node, i) => (
              <motion.g 
                 key={node.id}
                 initial={{ scale: 0, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 transition={{ type: "spring", stiffness: 260, damping: 20, delay: i * 0.05 }}
                 className="cursor-pointer group"
                 onClick={() => {
                     if (node.type === 'root') {
                         if (currentFolderId) {
                            // Go up one level (simple logic: just null for root, or parent if we tracked it)
                            const current = folders.find(f => f.id === currentFolderId);
                            onFolderClick(current?.parentId || null);
                         }
                     } else if (node.type === 'folder') {
                         onFolderClick(node.id);
                     } else {
                         onItemClick(node.id, node.type);
                     }
                 }}
              >
                 {/* Node Circle */}
                 <circle 
                    cx={node.x} cy={node.y} r={node.r} 
                    className={`transition-all duration-300 ${
                        node.type === 'root' ? 'fill-indigo-600 stroke-indigo-400 stroke-2' : 
                        node.type === 'folder' ? 'fill-zinc-800 stroke-zinc-600 hover:fill-zinc-700 hover:stroke-zinc-400' : 
                        node.type === 'credential' ? 'fill-emerald-900/50 stroke-emerald-600 hover:fill-emerald-800' :
                        'fill-amber-900/50 stroke-amber-600 hover:fill-amber-800'
                    }`}
                 />
                 
                 {/* Icon */}
                 <foreignObject x={node.x - (node.type === 'root' ? 12 : 8)} y={node.y - (node.type === 'root' ? 12 : 8)} width={node.type === 'root' ? 24 : 16} height={node.type === 'root' ? 24 : 16} className="pointer-events-none">
                     <div className={`flex items-center justify-center w-full h-full ${node.type === 'root' ? 'text-white' : node.type === 'folder' ? 'text-zinc-400' : node.type === 'credential' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {node.type === 'root' ? <Database size={node.r*0.6} /> : node.type === 'folder' ? <Folder size={node.r*0.6} /> : node.type === 'credential' ? <Lock size={node.r*0.8} /> : <FileText size={node.r*0.8} />}
                     </div>
                 </foreignObject>

                 {/* Label */}
                 <text 
                    x={node.x} y={node.y + node.r + 15} 
                    textAnchor="middle" 
                    className={`text-[10px] font-mono fill-zinc-500 pointer-events-none group-hover:fill-white transition-colors ${node.type === 'root' ? 'font-bold fill-indigo-400 text-xs' : ''}`}
                 >
                     {node.label}
                 </text>
                 
              </motion.g>
           ))}
        </svg>

        <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-none z-20">
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                <div className="w-2 h-2 rounded-full bg-indigo-600"></div> Current Context
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                <div className="w-2 h-2 rounded-full bg-zinc-700 border border-zinc-500"></div> Directory
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                <div className="w-2 h-2 rounded-full bg-emerald-900 border border-emerald-600"></div> Credential
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                <div className="w-2 h-2 rounded-full bg-amber-900 border border-amber-600"></div> Form
            </div>
        </div>
    </div>
  );
};

export default NetworkGraph;