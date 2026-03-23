import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { SubtreeResponse, TreeNode, Marriage } from '../../types';
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

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', height);
    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    const root = d3.hierarchy(data.tree, d => d.children);

    const treeLayout = d3.tree<TreeNode>()
      .nodeSize([220, 120])
      .separation((a, b) => a.parent === b.parent ? 1.3 : 1.6);
    treeLayout(root);

    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, 60).scale(0.7));

    const genColors = ['#6366F1', '#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE'];

    // Links
    g.selectAll('.link')
      .data(root.links())
      .join('path')
      .attr('d', d => {
        const sx = d.source.x!, sy = d.source.y! + 30;
        const tx = d.target.x!, ty = d.target.y! - 30;
        const my = (sy + ty) / 2;
        return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
      })
      .attr('stroke', '#D1D1D6').attr('stroke-width', 1.5).attr('fill', 'none');

    // Nodes
    const nodes = g.selectAll('.node')
      .data(root.descendants())
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    const cardW = 180;
    const cardH = 55;

    nodes.append('rect')
      .attr('x', -cardW / 2).attr('y', -cardH / 2)
      .attr('width', cardW).attr('height', cardH).attr('rx', 12)
      .attr('fill', d => d.data.death_date ? '#F9F9F9' : 'white')
      .attr('stroke', d => d.data.id === data.member.id ? '#FF9500' : genColors[(d.data.generation || 0) % genColors.length])
      .attr('stroke-width', d => d.data.id === data.member.id ? 2.5 : 1.5)
      .attr('filter', 'drop-shadow(0 1px 4px rgba(0,0,0,0.06))');

    // Deceased icon
    nodes.filter(d => !!(d.data.death_date))
      .append('text')
      .attr('x', cardW / 2 - 16).attr('y', -cardH / 2 + 15)
      .attr('text-anchor', 'middle').attr('font-size', '12px').text('🕊️');

    // Full name
    nodes.each(function(d) {
      const node = d3.select(this);
      const name = d.data.name;
      const words = name.split(' ');
      let lines: string[] = [];
      let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (test.length > 18 && cur) { lines.push(cur); cur = w; }
        else cur = test;
      }
      if (cur) lines.push(cur);

      const sy = lines.length > 1 ? -8 : 0;
      lines.forEach((line, i) => {
        node.append('text')
          .attr('x', 0).attr('y', sy + i * 15)
          .attr('text-anchor', 'middle')
          .attr('font-family', 'Tajawal, sans-serif')
          .attr('font-size', '11px')
          .attr('font-weight', d.data.id === data.member.id ? '800' : '600')
          .attr('fill', d.data.death_date ? '#999' : '#1D1D1F')
          .text(line);
      });
    });

    // Wives
    nodes.each(function(d) {
      if (!d.data.marriages?.length) return;
      const node = d3.select(this);
      d.data.marriages.forEach((m: Marriage, i: number) => {
        const wx = -(cardW / 2 + 15 + i * 125 + 55);
        const wh = 40;
        const isDivorced = m.status === 'divorced';
        const isDeceased = m.status === 'deceased' || m.status === 'widowed';

        node.append('line')
          .attr('x1', -cardW / 2).attr('y1', 0)
          .attr('x2', wx + 55).attr('y2', 0)
          .attr('stroke', isDivorced ? '#D1D1D6' : '#FF2D55')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', isDivorced ? '3,3' : 'none')
          .attr('opacity', isDivorced ? 0.4 : 0.6);

        node.append('rect')
          .attr('x', wx).attr('y', -wh / 2).attr('width', 110).attr('height', wh).attr('rx', 10)
          .attr('fill', isDivorced ? '#FAFAFA' : isDeceased ? '#F5F5F5' : '#FFF0F5')
          .attr('stroke', isDivorced ? '#D1D1D6' : '#FF2D55')
          .attr('stroke-width', 1).attr('opacity', isDivorced ? 0.5 : 1);

        if (isDeceased) {
          node.append('text').attr('x', wx + 100).attr('y', -wh / 2 + 14).attr('font-size', '10px').text('🕊️');
        }

        node.append('text')
          .attr('x', wx + 55).attr('y', 4)
          .attr('text-anchor', 'middle')
          .attr('font-family', 'Tajawal, sans-serif')
          .attr('font-size', '9px').attr('font-weight', '600')
          .attr('fill', isDivorced ? '#BBB' : isDeceased ? '#999' : '#C2185B')
          .text(m.wife_name || 'زوجة');
      });
    });
  }, [data]);

  const handleExportPdf = async () => {
    if (containerRef.current) await exportToPdf(containerRef.current, data.member.name);
  };

  const statusLabels: Record<string, string> = { married: 'متزوج', divorced: 'مطلق', widowed: 'أرمل', deceased: 'متوفاة' };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 bg-surface/50 border-b border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-3 h-3 rounded-full ${data.member.gender === 'female' ? 'bg-pink-500' : 'bg-primary'}`} />
              <h3 className="text-xl font-bold text-text m-0">{data.member.name}</h3>
              {data.member.death_date && <span className="text-sm">🕊️</span>}
            </div>
            <div className="flex items-center gap-4 text-sm text-text-secondary flex-wrap">
              <span>الجيل: {data.member.generation}</span>
              {data.member.birth_date && <span>الميلاد: {data.member.birth_date}</span>}
              {data.member.death_date && <span>الوفاة: {data.member.death_date}</span>}
              {data.member.city && <span>المدينة: {data.member.city}</span>}
              {data.member.occupation && <span>العمل: {data.member.occupation}</span>}
            </div>
            {data.member.marriages && data.member.marriages.length > 0 && (
              <div className="mt-1 flex items-center gap-3 flex-wrap text-sm">
                {data.member.marriages.map((m, i) => (
                  <span key={i} className={`px-2 py-0.5 rounded-lg text-xs ${m.status === 'divorced' ? 'bg-gray-100 text-gray-400' : 'bg-pink-50 text-pink-600'}`}>
                    {m.wife_name} ({statusLabels[m.status]})
                  </span>
                ))}
              </div>
            )}
            {data.member.bio && <div className="mt-1 text-sm text-text-secondary">{data.member.bio}</div>}
            {data.ancestors.length > 0 && (
              <div className="mt-2 text-sm text-text-secondary">
                <span className="font-medium">السلسلة: </span>
                {data.ancestors.map(a => a.name).join(' ← ')} ← {data.member.name}
              </div>
            )}
          </div>
          <button onClick={handleExportPdf} className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-dark transition-colors cursor-pointer border-none flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            تحميل PDF
          </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 min-h-[500px] bg-white">
        <svg ref={svgRef} className="w-full h-full" />
      </div>
    </div>
  );
}
