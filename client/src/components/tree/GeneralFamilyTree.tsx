import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { getGeneralFamilyTree, getGeneralMember } from '../../services/api';
import type { GeneralTreeNode, GeneralMarriage, GeneralMember } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';

interface GeneralFamilyTreeProps {
  familyId: number;
  familyName: string;
}

export default function GeneralFamilyTree({ familyId, familyName }: GeneralFamilyTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState<GeneralTreeNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<GeneralMember | null>(null);
  const [showModal, setShowModal] = useState(false);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const loadTree = useCallback(async () => {
    try {
      const data = await getGeneralFamilyTree(familyId);
      setTreeData(data.tree);
    } catch (err) {
      console.error('Error loading general tree:', err);
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const handleNodeClick = async (memberId: number) => {
    try {
      const member = await getGeneralMember(memberId);
      setSelectedMember(member);
      setShowModal(true);
    } catch (err) {
      console.error('Error loading member:', err);
    }
  };

  useEffect(() => {
    if (!treeData.length || !svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = Math.max(container.clientHeight, 600);

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Use first root or create virtual root
    const rootData = treeData.length === 1 ? treeData[0] : {
      id: 0, name: familyName, children: treeData, gender: 'male' as const, generation: 0, marriages: [] as GeneralMarriage[],
      family_id: familyId, father_id: null, mother_id: null, gedcom_id: null,
      birth_date: null, death_date: null, bio: null, phone: null, mother_name: null,
      city: null, nationality: null, occupation: null, work_type: null, work_place: null, created_at: '',
    };

    const root = d3.hierarchy(rootData as GeneralTreeNode, d => d.children);

    const nodeWidth = 260;
    const nodeHeight = 150;

    const treeLayout = d3.tree<GeneralTreeNode>()
      .nodeSize([nodeWidth, nodeHeight])
      .separation((a, b) => {
        const aWives = (a.data.marriages?.length || 0);
        const bWives = (b.data.marriages?.length || 0);
        const extra = Math.max(aWives, bWives) * 0.3;
        return (a.parent === b.parent ? 1.3 : 1.6) + extra;
      });

    treeLayout(root);

    // Calculate bounds for centering
    let minX = Infinity, maxX = -Infinity;
    root.each(d => {
      const dx = d.x ?? 0;
      if (dx < minX) minX = dx;
      if (dx > maxX) maxX = dx;
    });

    const treeWidth = maxX - minX + nodeWidth * 2;
    const scale = Math.min(width / (treeWidth + 200), 0.7);

    svg.call(zoom.transform, d3.zoomIdentity
      .translate(width / 2, 50)
      .scale(scale));

    const genColors = ['#6366F1', '#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5AC8FA', '#FF2D55'];

    // Draw links
    g.selectAll('.link')
      .data(root.links())
      .join('path')
      .attr('class', 'tree-link')
      .attr('d', d => {
        const sx = d.source.x!;
        const sy = d.source.y! + 40;
        const tx = d.target.x!;
        const ty = d.target.y! - 40;
        const my = (sy + ty) / 2;
        return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
      })
      .attr('stroke', '#D1D1D6')
      .attr('stroke-width', 1.5)
      .attr('fill', 'none')
      .attr('opacity', 0)
      .transition()
      .duration(800)
      .delay((_: unknown, i: number) => i * 20)
      .attr('opacity', 1);

    // Draw nodes
    const nodes = g.selectAll('.node')
      .data(root.descendants())
      .join('g')
      .attr('class', 'tree-node')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('opacity', 0);

    nodes.transition()
      .duration(600)
      .delay((_: unknown, i: number) => i * 30)
      .attr('opacity', 1);

    const cardW = 200;
    const cardH = 70;

    // Card background
    nodes.append('rect')
      .attr('class', 'node-card')
      .attr('x', -cardW / 2)
      .attr('y', -cardH / 2)
      .attr('width', cardW)
      .attr('height', cardH)
      .attr('rx', 14)
      .attr('fill', d => d.data.death_date ? '#F9F9F9' : 'white')
      .attr('stroke', d => {
        if (searchQuery && d.data.name.includes(searchQuery)) return '#FF9500';
        return genColors[(d.data.generation || 0) % genColors.length];
      })
      .attr('stroke-width', d => {
        if (searchQuery && d.data.name.includes(searchQuery)) return 3;
        return 1.5;
      })
      .attr('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.06))')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.data.id === 0) return;
        handleNodeClick(d.data.id);
      });

    // Deceased icon
    nodes.filter(d => !!(d.data.death_date))
      .append('text')
      .attr('x', cardW / 2 - 20)
      .attr('y', -cardH / 2 + 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .text('\u{1F54A}\u{FE0F}');

    // Gender indicator
    nodes.append('circle')
      .attr('cx', -cardW / 2 + 18)
      .attr('cy', -5)
      .attr('r', 10)
      .attr('fill', d => d.data.gender === 'female' ? '#FF2D55' : '#007AFF')
      .attr('opacity', 0.15)
      .style('pointer-events', 'none');

    nodes.append('text')
      .attr('x', -cardW / 2 + 18)
      .attr('y', -1)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .text(d => d.data.gender === 'female' ? '\u2640' : '\u2642')
      .attr('fill', d => d.data.gender === 'female' ? '#FF2D55' : '#007AFF')
      .style('pointer-events', 'none');

    // Name text wrapping
    nodes.each(function(d) {
      const node = d3.select(this);
      const name = d.data.name;

      const words = name.split(' ');
      let lines: string[] = [];
      let current = '';
      for (const w of words) {
        const test = current ? current + ' ' + w : w;
        if (test.length > 20 && current) {
          lines.push(current);
          current = w;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);
      if (lines.length > 2) lines = [lines.slice(0, 2).join(' '), lines.slice(2).join(' ')];

      const startY = lines.length > 1 ? -12 : -5;
      lines.forEach((line, i) => {
        node.append('text')
          .attr('x', 5)
          .attr('y', startY + i * 16)
          .attr('text-anchor', 'middle')
          .attr('font-family', 'Tajawal, sans-serif')
          .attr('font-size', '12px')
          .attr('font-weight', '700')
          .attr('fill', d.data.death_date ? '#999' : '#1D1D1F')
          .style('pointer-events', 'none')
          .text(line);
      });

      // Generation label
      node.append('text')
        .attr('x', 5)
        .attr('y', lines.length > 1 ? 22 : 15)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Tajawal, sans-serif')
        .attr('font-size', '9px')
        .attr('fill', '#86868B')
        .style('pointer-events', 'none')
        .text(d.data.generation ? `\u0627\u0644\u062C\u064A\u0644 ${d.data.generation}` : '');
    });

    // Draw wives beside husbands
    nodes.each(function(d) {
      if (!d.data.marriages || d.data.marriages.length === 0) return;
      const node = d3.select(this);

      d.data.marriages.forEach((marriage: GeneralMarriage, i: number) => {
        const wifeX = -(cardW / 2 + 20 + (i * (cardW * 0.7 + 10)) + cardW * 0.7 / 2);
        const wifeW = cardW * 0.7;
        const wifeH = 50;

        const isDivorced = marriage.status === 'divorced';
        const isDeceased = marriage.status === 'deceased' || marriage.status === 'widowed';

        // Connection line
        node.append('line')
          .attr('x1', -cardW / 2)
          .attr('y1', 0)
          .attr('x2', wifeX + wifeW / 2)
          .attr('y2', 0)
          .attr('stroke', isDivorced ? '#D1D1D6' : '#FF2D55')
          .attr('stroke-width', isDivorced ? 1 : 1.5)
          .attr('stroke-dasharray', isDivorced ? '4,4' : 'none')
          .attr('opacity', isDivorced ? 0.5 : 0.7);

        // Marriage symbol
        const midX = (-cardW / 2 + wifeX + wifeW / 2) / 2;
        node.append('circle')
          .attr('cx', midX)
          .attr('cy', 0)
          .attr('r', 6)
          .attr('fill', isDivorced ? '#D1D1D6' : '#FF2D55')
          .attr('opacity', isDivorced ? 0.4 : 0.8);
        node.append('text')
          .attr('x', midX)
          .attr('y', 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', '8px')
          .attr('fill', 'white')
          .style('pointer-events', 'none')
          .text(isDivorced ? '\u2715' : '\u2665');

        // Wife card
        node.append('rect')
          .attr('x', wifeX - wifeW / 2 + wifeW / 2)
          .attr('y', -wifeH / 2)
          .attr('width', wifeW)
          .attr('height', wifeH)
          .attr('rx', 12)
          .attr('fill', isDivorced ? '#FAFAFA' : (isDeceased ? '#F5F5F5' : '#FFF0F5'))
          .attr('stroke', isDivorced ? '#D1D1D6' : '#FF2D55')
          .attr('stroke-width', 1)
          .attr('opacity', isDivorced ? 0.5 : 1)
          .attr('filter', 'drop-shadow(0 1px 3px rgba(0,0,0,0.04))');

        // Deceased icon for wife
        if (isDeceased) {
          node.append('text')
            .attr('x', wifeX + wifeW - 10)
            .attr('y', -wifeH / 2 + 16)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .text('\u{1F54A}\u{FE0F}');
        }

        // Wife name
        const wifeName = marriage.wife_name || '\u0632\u0648\u062C\u0629';
        const wWords = wifeName.split(' ');
        let wLines: string[] = [];
        let wCurrent = '';
        for (const w of wWords) {
          const test = wCurrent ? wCurrent + ' ' + w : w;
          if (test.length > 14 && wCurrent) { wLines.push(wCurrent); wCurrent = w; }
          else wCurrent = test;
        }
        if (wCurrent) wLines.push(wCurrent);

        const wStartY = wLines.length > 1 ? -8 : 0;
        wLines.forEach((line, li) => {
          node.append('text')
            .attr('x', wifeX + wifeW / 2)
            .attr('y', wStartY + li * 14)
            .attr('text-anchor', 'middle')
            .attr('font-family', 'Tajawal, sans-serif')
            .attr('font-size', '10px')
            .attr('font-weight', '600')
            .attr('fill', isDivorced ? '#BBB' : (isDeceased ? '#999' : '#C2185B'))
            .attr('opacity', isDivorced ? 0.6 : 1)
            .style('pointer-events', 'none')
            .text(line);
        });

        // Status label
        const statusLabels: Record<string, string> = { married: '\u0645\u062A\u0632\u0648\u062C', divorced: '\u0645\u0637\u0644\u0642', widowed: '\u0623\u0631\u0645\u0644', deceased: '\u0645\u062A\u0648\u0641\u0627\u0629' };
        node.append('text')
          .attr('x', wifeX + wifeW / 2)
          .attr('y', wifeH / 2 - 5)
          .attr('text-anchor', 'middle')
          .attr('font-family', 'Tajawal, sans-serif')
          .attr('font-size', '8px')
          .attr('fill', isDivorced ? '#CCC' : '#86868B')
          .style('pointer-events', 'none')
          .text(statusLabels[marriage.status] || '');
      });
    });

    // Hover effects
    nodes.selectAll('.node-card')
      .on('mouseenter', function () {
        d3.select(this)
          .transition().duration(200)
          .attr('filter', 'drop-shadow(0 4px 16px rgba(0,0,0,0.12))')
          .attr('stroke-width', 2.5);
      })
      .on('mouseleave', function () {
        d3.select(this)
          .transition().duration(200)
          .attr('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.06))')
          .attr('stroke-width', 1.5);
      });

    // Auto-zoom to search match
    if (searchQuery) {
      const match = root.descendants().find(d => d.data.name.includes(searchQuery));
      if (match) {
        svg.transition().duration(750).call(
          zoom.transform,
          d3.zoomIdentity.translate(width / 2 - match.x! * 1.2, height / 3 - match.y! * 1.2).scale(1.2)
        );
      }
    }
  }, [treeData, searchQuery, familyId, familyName]);

  const handleZoom = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy, factor);
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="h-[100dvh] md:h-screen flex flex-col pb-16 md:pb-0">
      {/* Search */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 text-center">
          <div className="max-w-md mx-auto relative">
            <input
              type="text"
              placeholder="\u0627\u0628\u062D\u062B \u0639\u0646 \u0627\u0633\u0645..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-5 py-2.5 pr-12 rounded-full bg-surface border-none text-text placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
            <svg className="absolute top-1/2 right-4 -translate-y-1/2 text-text-secondary" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Tree Container */}
      <div ref={containerRef} className="flex-1 bg-surface overflow-hidden relative">
        <svg ref={svgRef} className="w-full h-full" />
        {/* Zoom controls */}
        <div className="absolute bottom-20 md:bottom-6 left-4 md:left-6 flex flex-col gap-2 z-10">
          <button onClick={() => handleZoom(1.3)} className="w-11 h-11 bg-white rounded-xl shadow-lg flex items-center justify-center text-text hover:bg-gray-50 transition-colors cursor-pointer border-none text-lg font-bold active:bg-gray-100">+</button>
          <button onClick={() => handleZoom(0.7)} className="w-11 h-11 bg-white rounded-xl shadow-lg flex items-center justify-center text-text hover:bg-gray-50 transition-colors cursor-pointer border-none text-lg font-bold active:bg-gray-100">&minus;</button>
        </div>
        {/* Legend */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl p-3 text-xs space-y-1.5 shadow-sm hidden sm:block">
          <div className="flex items-center gap-2"><span>{'\u{1F54A}\u{FE0F}'}</span><span className="text-text-secondary">{'\u0645\u062A\u0648\u0641\u0649'}</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-pink-500 inline-block"></span><span className="text-text-secondary">{'\u0632\u0648\u062C\u0629'}</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-0.5 bg-gray-300 inline-block" style={{borderTop: '1px dashed #ccc'}}></span><span className="text-text-secondary">{'\u0645\u0637\u0644\u0642\u0629'}</span></div>
        </div>
      </div>

      {/* Member Details Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setSelectedMember(null); }}
        title={selectedMember?.name}
        size="md"
      >
        {selectedMember && (
          <div className="p-4 space-y-4" dir="rtl">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-text-secondary">{'\u0627\u0644\u0627\u0633\u0645'}</span>
                <p className="font-semibold">{selectedMember.name}</p>
              </div>
              <div>
                <span className="text-xs text-text-secondary">{'\u0627\u0644\u062C\u0646\u0633'}</span>
                <p className="font-semibold">{selectedMember.gender === 'male' ? '\u0630\u0643\u0631' : '\u0623\u0646\u062B\u0649'}</p>
              </div>
              {selectedMember.birth_date && (
                <div>
                  <span className="text-xs text-text-secondary">{'\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u064A\u0644\u0627\u062F'}</span>
                  <p className="font-semibold">{selectedMember.birth_date}</p>
                </div>
              )}
              {selectedMember.death_date && (
                <div>
                  <span className="text-xs text-text-secondary">{'\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0648\u0641\u0627\u0629'}</span>
                  <p className="font-semibold">{selectedMember.death_date}</p>
                </div>
              )}
              {selectedMember.city && (
                <div>
                  <span className="text-xs text-text-secondary">{'\u0627\u0644\u0645\u062F\u064A\u0646\u0629'}</span>
                  <p className="font-semibold">{selectedMember.city}</p>
                </div>
              )}
              {selectedMember.occupation && (
                <div>
                  <span className="text-xs text-text-secondary">{'\u0627\u0644\u0645\u0647\u0646\u0629'}</span>
                  <p className="font-semibold">{selectedMember.occupation}</p>
                </div>
              )}
              {selectedMember.nationality && (
                <div>
                  <span className="text-xs text-text-secondary">{'\u0627\u0644\u062C\u0646\u0633\u064A\u0629'}</span>
                  <p className="font-semibold">{selectedMember.nationality}</p>
                </div>
              )}
              <div>
                <span className="text-xs text-text-secondary">{'\u0627\u0644\u062C\u064A\u0644'}</span>
                <p className="font-semibold">{selectedMember.generation}</p>
              </div>
            </div>

            {selectedMember.father && (
              <div>
                <span className="text-xs text-text-secondary">{'\u0627\u0644\u0623\u0628'}</span>
                <p className="font-semibold">{selectedMember.father.name}</p>
              </div>
            )}

            {selectedMember.mother && (
              <div>
                <span className="text-xs text-text-secondary">{'\u0627\u0644\u0623\u0645'}</span>
                <p className="font-semibold">{selectedMember.mother.name}</p>
              </div>
            )}

            {selectedMember.mother_name && !selectedMember.mother && (
              <div>
                <span className="text-xs text-text-secondary">{'\u0627\u0633\u0645 \u0627\u0644\u0623\u0645'}</span>
                <p className="font-semibold">{selectedMember.mother_name}</p>
              </div>
            )}

            {selectedMember.marriages && selectedMember.marriages.length > 0 && (
              <div>
                <span className="text-xs text-text-secondary">{'\u0627\u0644\u0632\u064A\u062C\u0627\u062A'}</span>
                <div className="space-y-1 mt-1">
                  {selectedMember.marriages.map(m => (
                    <p key={m.id} className="text-sm">
                      {m.wife_name || '\u0632\u0648\u062C\u0629'}
                      <span className="text-text-secondary mr-2">({m.status === 'married' ? '\u0645\u062A\u0632\u0648\u062C' : m.status === 'divorced' ? '\u0645\u0637\u0644\u0642' : m.status === 'widowed' ? '\u0623\u0631\u0645\u0644' : '\u0645\u062A\u0648\u0641\u0627\u0629'})</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {selectedMember.children && selectedMember.children.length > 0 && (
              <div>
                <span className="text-xs text-text-secondary">{'\u0627\u0644\u0623\u0628\u0646\u0627\u0621'} ({selectedMember.children.length})</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedMember.children.map(c => (
                    <span key={c.id} className="text-sm bg-surface px-2 py-1 rounded-lg">
                      {c.gender === 'female' ? '\u2640' : '\u2642'} {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedMember.bio && (
              <div>
                <span className="text-xs text-text-secondary">{'\u0645\u0644\u0627\u062D\u0638\u0627\u062A'}</span>
                <p className="text-sm whitespace-pre-wrap">{selectedMember.bio}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
