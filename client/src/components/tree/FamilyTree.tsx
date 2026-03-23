import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { getMembersTree, getMemberSubtree } from '../../services/api';
import type { TreeNode, SubtreeResponse } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import Modal from '../common/Modal';
import SubTreeView from './SubTreeView';

export default function FamilyTree() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<SubtreeResponse | null>(null);
  const [showModal, setShowModal] = useState(false);

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

  useEffect(() => {
    if (!treeData.length || !svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = Math.max(container.clientHeight, 600);

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Use first root or create virtual root
    const rootData = treeData.length === 1 ? treeData[0] : {
      id: 0,
      name: 'آل بامفلح',
      children: treeData,
      gender: 'male' as const,
      generation: 0,
    };

    const root = d3.hierarchy(rootData as TreeNode, d => d.children);

    const nodeWidth = 180;
    const nodeHeight = 120;

    const treeLayout = d3.tree<TreeNode>()
      .nodeSize([nodeWidth, nodeHeight])
      .separation((a, b) => a.parent === b.parent ? 1.2 : 1.5);

    treeLayout(root);

    // Calculate bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    root.each(d => {
      const dx = d.x ?? 0;
      const dy = d.y ?? 0;
      if (dx < minX) minX = dx;
      if (dx > maxX) maxX = dx;
      if (dy < minY) minY = dy;
      if (dy > maxY) maxY = dy;
    });

    const treeWidth = maxX - minX + nodeWidth * 2;
    const treeHeight = maxY - minY + nodeHeight * 2;

    // Center the tree
    const initialX = width / 2;
    const initialY = 60;
    const scale = Math.min(width / (treeWidth + 100), height / (treeHeight + 100), 1);

    svg.call(zoom.transform, d3.zoomIdentity
      .translate(initialX, initialY)
      .scale(scale));

    // Generation colors
    const genColors = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5AC8FA', '#FF2D55'];

    // Draw links
    g.selectAll('.link')
      .data(root.links())
      .join('path')
      .attr('class', 'tree-link')
      .attr('d', d => {
        const sourceX = d.source.x!;
        const sourceY = d.source.y! + 35;
        const targetX = d.target.x!;
        const targetY = d.target.y! - 35;
        const midY = (sourceY + targetY) / 2;
        return `M${sourceX},${sourceY} C${sourceX},${midY} ${targetX},${midY} ${targetX},${targetY}`;
      })
      .attr('stroke', '#D1D1D6')
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .attr('opacity', 0)
      .transition()
      .duration(800)
      .delay((_, i) => i * 30)
      .attr('opacity', 1);

    // Draw nodes
    const nodes = g.selectAll('.node')
      .data(root.descendants())
      .join('g')
      .attr('class', 'tree-node')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('opacity', 0)
      .style('cursor', 'pointer')
      .on('click', (_, d) => {
        if (d.data.id !== 0) {
          handleNodeClick(d.data.id);
        }
      });

    // Animate nodes in
    nodes.transition()
      .duration(600)
      .delay((_, i) => i * 50)
      .attr('opacity', 1);

    // Node background
    nodes.append('rect')
      .attr('x', -75)
      .attr('y', -30)
      .attr('width', 150)
      .attr('height', 60)
      .attr('rx', 16)
      .attr('ry', 16)
      .attr('fill', 'white')
      .attr('stroke', d => genColors[(d.data.generation || 0) % genColors.length])
      .attr('stroke-width', 2)
      .attr('filter', 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))');

    // Gender indicator
    nodes.append('circle')
      .attr('cx', -55)
      .attr('cy', 0)
      .attr('r', 12)
      .attr('fill', d => d.data.gender === 'female' ? '#FF2D55' : '#007AFF')
      .attr('opacity', 0.15);

    nodes.append('text')
      .attr('x', -55)
      .attr('y', 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .text(d => d.data.gender === 'female' ? '♀' : '♂')
      .attr('fill', d => d.data.gender === 'female' ? '#FF2D55' : '#007AFF');

    // Name text
    nodes.append('text')
      .attr('x', 5)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'Tajawal, sans-serif')
      .attr('font-size', '13px')
      .attr('font-weight', '700')
      .attr('fill', '#1D1D1F')
      .text(d => {
        const name = d.data.name;
        return name.length > 20 ? name.slice(0, 20) + '…' : name;
      });

    // Generation label
    nodes.append('text')
      .attr('x', 5)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'Tajawal, sans-serif')
      .attr('font-size', '10px')
      .attr('fill', '#86868B')
      .text(d => d.data.generation ? `الجيل ${d.data.generation}` : '');

    // Hover effects
    nodes
      .on('mouseenter', function () {
        d3.select(this).select('rect')
          .transition().duration(200)
          .attr('filter', 'drop-shadow(0 4px 16px rgba(0,0,0,0.15))')
          .attr('stroke-width', 3);
      })
      .on('mouseleave', function () {
        d3.select(this).select('rect')
          .transition().duration(200)
          .attr('filter', 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))')
          .attr('stroke-width', 2);
      });

    // Search highlight
    if (searchQuery) {
      nodes.select('rect')
        .attr('stroke-width', d =>
          d.data.name.includes(searchQuery) ? 4 : 2
        )
        .attr('stroke', d =>
          d.data.name.includes(searchQuery)
            ? '#FF9500'
            : genColors[(d.data.generation || 0) % genColors.length]
        );

      // Auto-zoom to first match
      const match = root.descendants().find(d => d.data.name.includes(searchQuery));
      if (match) {
        svg.transition().duration(750).call(
          zoom.transform,
          d3.zoomIdentity.translate(width / 2 - match.x! * 1.2, height / 3 - match.y! * 1.2).scale(1.2)
        );
      }
    }
  }, [treeData, searchQuery]);

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="h-screen flex flex-col">
      {/* Hero Section */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center">
          <h1 className="text-4xl font-black text-text mb-2">شجرة عائلة آل بامفلح</h1>
          <p className="text-text-secondary text-lg mb-6">استعرض شجرة العائلة الكاملة - اضغط على أي شخص لعرض شجرته الخاصة</p>
          <div className="max-w-md mx-auto relative">
            <input
              type="text"
              placeholder="ابحث عن اسم..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-5 py-3 pr-12 rounded-full bg-surface border-none text-text placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
            <svg className="absolute top-1/2 right-4 -translate-y-1/2 text-text-secondary" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <button
            onClick={() => {
              const svg = d3.select(svgRef.current!);
              svg.transition().duration(300).call(
                d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 3]).on('zoom', () => {}).scaleBy as any,
                1.3
              );
            }}
            className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-text hover:bg-gray-50 transition-colors cursor-pointer border-none text-lg font-bold"
          >
            +
          </button>
          <button
            onClick={() => {
              const svg = d3.select(svgRef.current!);
              svg.transition().duration(300).call(
                d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 3]).on('zoom', () => {}).scaleBy as any,
                0.7
              );
            }}
            className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-text hover:bg-gray-50 transition-colors cursor-pointer border-none text-lg font-bold"
          >
            −
          </button>
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
    </div>
  );
}
