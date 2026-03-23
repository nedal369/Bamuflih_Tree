import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { SubtreeResponse, TreeNode } from '../../types';
import { exportToPdf } from '../../services/pdfExport';

interface Props {
  data: SubtreeResponse;
  onClose: () => void;
}

export default function SubTreeView({ data, onClose: _onClose }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = Math.max(500, container.clientHeight);

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));

    svg.call(zoom);

    const root = d3.hierarchy(data.tree, d => d.children);

    const treeLayout = d3.tree<TreeNode>()
      .nodeSize([160, 100])
      .separation((a, b) => a.parent === b.parent ? 1.2 : 1.5);

    treeLayout(root);

    // Center
    const scale = 0.8;
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, 60).scale(scale));

    const genColors = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5AC8FA'];

    // Links
    g.selectAll('.link')
      .data(root.links())
      .join('path')
      .attr('class', 'tree-link')
      .attr('d', d => {
        const sx = d.source.x!, sy = d.source.y! + 30;
        const tx = d.target.x!, ty = d.target.y! - 30;
        const my = (sy + ty) / 2;
        return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
      })
      .attr('stroke', '#D1D1D6')
      .attr('stroke-width', 2)
      .attr('fill', 'none');

    // Nodes
    const nodes = g.selectAll('.node')
      .data(root.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    nodes.append('rect')
      .attr('x', -70)
      .attr('y', -25)
      .attr('width', 140)
      .attr('height', 50)
      .attr('rx', 14)
      .attr('fill', 'white')
      .attr('stroke', d => {
        if (d.data.id === data.member.id) return '#FF9500';
        return genColors[(d.data.generation || 0) % genColors.length];
      })
      .attr('stroke-width', d => d.data.id === data.member.id ? 3 : 2)
      .attr('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.08))');

    nodes.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 5)
      .attr('font-family', 'Tajawal, sans-serif')
      .attr('font-size', '12px')
      .attr('font-weight', d => d.data.id === data.member.id ? '800' : '600')
      .attr('fill', '#1D1D1F')
      .text(d => {
        const name = d.data.name;
        return name.length > 18 ? name.slice(0, 18) + '…' : name;
      });
  }, [data]);

  const handleExportPdf = async () => {
    if (containerRef.current) {
      await exportToPdf(containerRef.current, data.member.name);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Member Info */}
      <div className="px-6 py-4 bg-surface/50 border-b border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-3 h-3 rounded-full ${data.member.gender === 'female' ? 'bg-pink-500' : 'bg-primary'}`} />
              <h3 className="text-xl font-bold text-text m-0">{data.member.name}</h3>
            </div>
            <div className="flex items-center gap-4 text-sm text-text-secondary">
              <span>الجيل: {data.member.generation}</span>
              {data.member.birth_date && <span>الميلاد: {data.member.birth_date}</span>}
              {data.member.death_date && <span>الوفاة: {data.member.death_date}</span>}
            </div>
            {data.ancestors.length > 0 && (
              <div className="mt-2 text-sm text-text-secondary">
                <span className="font-medium">السلسلة: </span>
                {data.ancestors.map(a => a.name).join(' ← ')} ← {data.member.name}
              </div>
            )}
          </div>
          <button
            onClick={handleExportPdf}
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-dark transition-colors cursor-pointer border-none flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            تحميل PDF
          </button>
        </div>
      </div>

      {/* Tree */}
      <div ref={containerRef} className="flex-1 min-h-[500px] bg-white">
        <svg ref={svgRef} className="w-full h-full" />
      </div>
    </div>
  );
}
