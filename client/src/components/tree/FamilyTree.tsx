import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { getMembersTree, getMemberSubtree, createMember, addMarriage } from '../../services/api';
import type { TreeNode, SubtreeResponse, Marriage } from '../../types';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';
import SubTreeView from './SubTreeView';

interface QuickAddState {
  mode: 'child' | 'wife' | 'sibling';
  memberId: number;
  memberName: string;
  fatherId: number | null;
  generation: number;
}

export default function FamilyTree() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<SubtreeResponse | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddGender, setQuickAddGender] = useState<'male' | 'female'>('male');
  const [quickAddStatus, setQuickAddStatus] = useState<'married' | 'divorced' | 'widowed' | 'deceased'>('married');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const { isAuthenticated } = useAuth();

  const loadTree = useCallback(async () => {
    try {
      const data = await getMembersTree();
      setTreeData(data);
    } catch (err) {
      console.error('Error loading tree:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const handleNodeClick = async (memberId: number) => {
    try {
      const subtree = await getMemberSubtree(memberId);
      setSelectedMember(subtree);
      setShowModal(true);
    } catch (err) {
      console.error('Error loading subtree:', err);
    }
  };

  const openQuickAdd = (mode: QuickAddState['mode'], memberId: number, memberName: string, fatherId: number | null, generation: number) => {
    setQuickAdd({ mode, memberId, memberName, fatherId, generation });
    setQuickAddName('');
    setQuickAddGender('male');
    setQuickAddStatus('married');
    setQuickAddError('');
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAdd || !quickAddName.trim()) return;

    setQuickAddLoading(true);
    setQuickAddError('');

    try {
      if (quickAdd.mode === 'child') {
        await createMember({
          name: quickAddName.trim(),
          father_id: quickAdd.memberId,
          gender: quickAddGender,
          generation: quickAdd.generation + 1,
        });
      } else if (quickAdd.mode === 'wife') {
        await addMarriage(quickAdd.memberId, {
          wife_name: quickAddName.trim(),
          status: quickAddStatus,
        });
      } else if (quickAdd.mode === 'sibling') {
        await createMember({
          name: quickAddName.trim(),
          father_id: quickAdd.fatherId,
          gender: quickAddGender,
          generation: quickAdd.generation,
        });
      }

      setQuickAdd(null);
      await loadTree();
    } catch (err: any) {
      setQuickAddError(err.response?.data?.error || 'حدث خطأ أثناء الإضافة');
    } finally {
      setQuickAddLoading(false);
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
      .scaleExtent([0.05, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Use first root or create virtual root
    const rootData = treeData.length === 1 ? treeData[0] : {
      id: 0, name: 'آل بامفلح', children: treeData, gender: 'male' as const, generation: 0, marriages: [] as Marriage[],
    };

    const root = d3.hierarchy(rootData as TreeNode, d => d.children);

    const nodeWidth = 260;
    const nodeHeight = 150;

    const treeLayout = d3.tree<TreeNode>()
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

    // Main member card
    const cardW = 200;
    const cardH = 70;

    // Card background - clickable area
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
      .attr('stroke-width', d => (searchQuery && d.data.name.includes(searchQuery)) ? 3 : 1.5)
      .attr('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.06))')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.data.id !== 0) handleNodeClick(d.data.id);
      });

    // Deceased icon
    nodes.filter(d => !!(d.data.death_date))
      .append('text')
      .attr('x', cardW / 2 - 20)
      .attr('y', -cardH / 2 + 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .text('🕊️');

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
      .text(d => d.data.gender === 'female' ? '♀' : '♂')
      .attr('fill', d => d.data.gender === 'female' ? '#FF2D55' : '#007AFF')
      .style('pointer-events', 'none');

    // Full name - wrap text
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
        .text(d.data.generation ? `الجيل ${d.data.generation}` : '');
    });

    // Draw wives beside husbands
    nodes.each(function(d) {
      if (!d.data.marriages || d.data.marriages.length === 0) return;
      const node = d3.select(this);

      d.data.marriages.forEach((marriage: Marriage, i: number) => {
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
          .text(isDivorced ? '✕' : '♥');

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
            .text('🕊️');
        }

        // Wife name
        const wifeName = marriage.wife_name || 'زوجة';
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
        const statusLabels: Record<string, string> = { married: 'متزوج', divorced: 'مطلق', widowed: 'أرمل', deceased: 'متوفاة' };
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

    // Quick-add buttons (only for authenticated users)
    if (isAuthenticated) {
      nodes.each(function(d) {
        if (d.data.id === 0) return; // Skip virtual root
        const node = d3.select(this);
        const btnR = 11;

        // "+" button BELOW for adding child (only for males)
        if (d.data.gender === 'male') {
          const childBtn = node.append('g')
            .attr('class', 'quick-add-btn')
            .attr('transform', `translate(0, ${cardH / 2 + 18})`)
            .style('cursor', 'pointer')
            .attr('opacity', 0.4)
            .on('mouseenter', function() { d3.select(this).attr('opacity', 1); })
            .on('mouseleave', function() { d3.select(this).attr('opacity', 0.4); })
            .on('click', (event) => {
              event.stopPropagation();
              openQuickAdd('child', d.data.id, d.data.name, d.data.father_id, d.data.generation || 1);
            });

          childBtn.append('circle')
            .attr('r', btnR)
            .attr('fill', '#34C759')
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .attr('filter', 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))');

          childBtn.append('text')
            .attr('text-anchor', 'middle')
            .attr('y', 4)
            .attr('font-size', '14px')
            .attr('font-weight', '700')
            .attr('fill', 'white')
            .style('pointer-events', 'none')
            .text('+');

          // Tooltip
          childBtn.append('title').text('إضافة ابن/ابنة');
        }

        // "+" button to the LEFT for adding wife (only for males)
        if (d.data.gender === 'male') {
          const wifeCount = d.data.marriages?.length || 0;
          const wifeOffset = wifeCount > 0
            ? -(cardW / 2 + 20 + wifeCount * (cardW * 0.7 + 10) + 10)
            : -(cardW / 2 + 22);

          const wifeBtn = node.append('g')
            .attr('class', 'quick-add-btn')
            .attr('transform', `translate(${wifeOffset}, 0)`)
            .style('cursor', 'pointer')
            .attr('opacity', 0.4)
            .on('mouseenter', function() { d3.select(this).attr('opacity', 1); })
            .on('mouseleave', function() { d3.select(this).attr('opacity', 0.4); })
            .on('click', (event) => {
              event.stopPropagation();
              openQuickAdd('wife', d.data.id, d.data.name, d.data.father_id, d.data.generation || 1);
            });

          wifeBtn.append('circle')
            .attr('r', btnR)
            .attr('fill', '#FF2D55')
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .attr('filter', 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))');

          wifeBtn.append('text')
            .attr('text-anchor', 'middle')
            .attr('y', 4)
            .attr('font-size', '14px')
            .attr('font-weight', '700')
            .attr('fill', 'white')
            .style('pointer-events', 'none')
            .text('+');

          wifeBtn.append('title').text('إضافة زوجة');
        }

        // "+" button to the RIGHT for adding sibling (when node has a father)
        if (d.data.father_id) {
          const siblingBtn = node.append('g')
            .attr('class', 'quick-add-btn')
            .attr('transform', `translate(${cardW / 2 + 22}, 0)`)
            .style('cursor', 'pointer')
            .attr('opacity', 0.4)
            .on('mouseenter', function() { d3.select(this).attr('opacity', 1); })
            .on('mouseleave', function() { d3.select(this).attr('opacity', 0.4); })
            .on('click', (event) => {
              event.stopPropagation();
              openQuickAdd('sibling', d.data.id, d.data.name, d.data.father_id, d.data.generation || 1);
            });

          siblingBtn.append('circle')
            .attr('r', btnR)
            .attr('fill', '#007AFF')
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .attr('filter', 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))');

          siblingBtn.append('text')
            .attr('text-anchor', 'middle')
            .attr('y', 4)
            .attr('font-size', '14px')
            .attr('font-weight', '700')
            .attr('fill', 'white')
            .style('pointer-events', 'none')
            .text('+');

          siblingBtn.append('title').text('إضافة أخ/أخت');
        }
      });
    }

    // Hover effects on card
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
  }, [treeData, searchQuery, isAuthenticated]);

  const handleZoom = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy, factor);
  };

  if (loading) return <LoadingSpinner size="lg" />;

  const quickAddTitle = quickAdd
    ? quickAdd.mode === 'child'
      ? `إضافة ابن/ابنة لـ ${quickAdd.memberName}`
      : quickAdd.mode === 'wife'
        ? `إضافة زوجة لـ ${quickAdd.memberName}`
        : `إضافة أخ/أخت لـ ${quickAdd.memberName}`
    : '';

  return (
    <div className="h-screen flex flex-col">
      {/* Hero Section */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center">
          <h1 className="text-3xl font-black text-text mb-2">شجرة عائلة آل بامفلح</h1>
          <p className="text-text-secondary text-sm mb-4">اضغط على أي شخص لعرض شجرته الخاصة وتفاصيله</p>
          <div className="max-w-md mx-auto relative">
            <input
              type="text"
              placeholder="ابحث عن اسم..."
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
        <div className="absolute bottom-6 left-6 flex flex-col gap-2">
          <button onClick={() => handleZoom(1.3)} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-text hover:bg-gray-50 transition-colors cursor-pointer border-none text-lg font-bold">+</button>
          <button onClick={() => handleZoom(0.7)} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-text hover:bg-gray-50 transition-colors cursor-pointer border-none text-lg font-bold">−</button>
        </div>
        {/* Legend */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl p-3 text-xs space-y-1.5 shadow-sm">
          <div className="flex items-center gap-2"><span>🕊️</span><span className="text-text-secondary">متوفى</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-pink-500 inline-block"></span><span className="text-text-secondary">زوجة</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-0.5 bg-gray-300 inline-block" style={{borderTop: '1px dashed #ccc'}}></span><span className="text-text-secondary">مطلقة</span></div>
          {isAuthenticated && (
            <>
              <hr className="border-gray-200 my-1" />
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span><span className="text-text-secondary">+ ابن/ابنة</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-pink-600 inline-block"></span><span className="text-text-secondary">+ زوجة</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span><span className="text-text-secondary">+ أخ/أخت</span></div>
            </>
          )}
        </div>
      </div>

      {/* Subtree Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setSelectedMember(null); }}
        title={selectedMember?.member.name}
        size="full"
      >
        {selectedMember && (
          <SubTreeView data={selectedMember} onClose={() => setShowModal(false)} />
        )}
      </Modal>

      {/* Quick Add Modal */}
      <Modal
        isOpen={!!quickAdd}
        onClose={() => setQuickAdd(null)}
        title={quickAddTitle}
        size="sm"
      >
        {quickAdd && (
          <form onSubmit={handleQuickAddSubmit} className="p-4 space-y-4" dir="rtl">
            {quickAddError && (
              <div className="bg-red-50 text-red-600 text-sm font-medium px-4 py-3 rounded-xl">{quickAddError}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                {quickAdd.mode === 'wife' ? 'اسم الزوجة' : 'الاسم'}
              </label>
              <input
                type="text"
                value={quickAddName}
                onChange={e => setQuickAddName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none text-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm"
                placeholder={quickAdd.mode === 'wife' ? 'مثال: فاطمة محمد' : 'مثال: عبدالله محمد'}
                required
                autoFocus
              />
            </div>

            {quickAdd.mode !== 'wife' && (
              <div>
                <label className="block text-sm font-medium text-text mb-2">الجنس</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={quickAddGender === 'male'}
                      onChange={() => setQuickAddGender('male')}
                      className="accent-blue-500"
                    />
                    <span className="text-sm">ذكر</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={quickAddGender === 'female'}
                      onChange={() => setQuickAddGender('female')}
                      className="accent-pink-500"
                    />
                    <span className="text-sm">أنثى</span>
                  </label>
                </div>
              </div>
            )}

            {quickAdd.mode === 'wife' && (
              <div>
                <label className="block text-sm font-medium text-text mb-2">حالة الزواج</label>
                <select
                  value={quickAddStatus}
                  onChange={e => setQuickAddStatus(e.target.value as typeof quickAddStatus)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border-none text-text focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm"
                >
                  <option value="married">متزوج</option>
                  <option value="divorced">مطلق</option>
                  <option value="widowed">أرمل</option>
                  <option value="deceased">متوفاة</option>
                </select>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={quickAddLoading}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium text-sm hover:bg-blue-600 transition-colors cursor-pointer border-none disabled:opacity-50"
              >
                {quickAddLoading ? 'جاري الإضافة...' : 'إضافة'}
              </button>
              <button
                type="button"
                onClick={() => setQuickAdd(null)}
                className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors cursor-pointer border-none"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
