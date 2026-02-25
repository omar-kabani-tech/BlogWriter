/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  PlusCircle, 
  Search, 
  User, 
  MoreVertical,
  ChevronRight,
  Clock,
  CheckCircle2,
  FileEdit,
  Trash2,
  Tags,
  Globe,
  Search as SearchIcon,
  Image as ImageIcon,
  Upload,
  X,
  Calendar as CalendarIcon,
  ChevronLeft,
  Filter,
  CalendarDays,
  Sparkles,
  Loader2,
  LogOut,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Download,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO
} from 'date-fns';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2, 
  Quote, 
  Undo, 
  Redo,
  Code
} from 'lucide-react';
import { BlogPost, Screen, PostStatus } from './types';
import { supabase } from './lib/supabase';
import { useEffect } from 'react';

const SoftrifyLogo = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path 
      d="M12 2L4 6V18L12 22L20 18V6L12 2Z" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className="opacity-20"
    />
    <path 
      d="M16 8.5C16 8.5 15 7 12 7C9 7 8 8.5 8 10C8 11.5 9.5 12 12 12C14.5 12 16 12.5 16 14C16 15.5 15 17 12 17C9 17 8 15.5 8 15.5" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const INITIAL_CATEGORIES = ['Technology', 'Lifestyle', 'Business', 'Design', 'Marketing'];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ id: string, name: string, email: string } | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PostStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string, end: string }>({ start: '', end: '' });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        fetchProfile(session.user.id, session.user);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsAuthenticated(true);
        fetchProfile(session.user.id, session.user);
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setPosts([]);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, authUser?: any) => {
    try {
      // 1. If we already have the authUser object, use it for immediate UI update
      if (authUser) {
        setUser({ 
          id: authUser.id, 
          name: authUser.user_metadata?.name || 'New User', 
          email: authUser.email || '' 
        });
      }

      // 2. Try to get the latest profile from the database
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profile) {
        setUser({ id: profile.id, name: profile.name, email: profile.email });
      } else if (!authUser) {
        // 3. If no profile record and no authUser passed, fetch it
        const { data: { user: fetchedUser } } = await supabase.auth.getUser();
        if (fetchedUser) {
          setUser({ 
            id: fetchedUser.id, 
            name: fetchedUser.user_metadata?.name || 'New User', 
            email: fetchedUser.email || '' 
          });
        }
      }
      fetchPosts(userId);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setIsLoading(false);
    }
  };

  const fetchPosts = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (data) {
        const mappedPosts: BlogPost[] = data.map(p => ({
          id: p.id,
          title: p.title,
          content: p.content,
          status: p.status as PostStatus,
          category: p.category,
          tags: p.tags || [],
          featuredImage: p.featured_image,
          seo: {
            metaTitle: p.meta_title || '',
            metaDescription: p.meta_description || '',
            focusKeyword: p.focus_keyword || '',
            slug: p.slug || ''
          },
          scheduledAt: p.scheduled_at,
          createdAt: p.created_at,
          updatedAt: p.updated_at
        }));
        setPosts(mappedPosts);
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // All unique tags for filter
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    posts.forEach(p => {
      if (p.tags && Array.isArray(p.tags)) {
        p.tags.forEach(t => tags.add(t));
      }
    });
    return Array.from(tags);
  }, [posts]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: posts.length,
      published: posts.filter(p => p.status === 'published').length,
      drafts: posts.filter(p => p.status === 'draft').length,
    };
  }, [posts]);

  const handleCreatePost = async (newPost: Partial<BlogPost>) => {
    if (!user) return;

    const postData = {
      user_id: user.id,
      title: newPost.title || 'Untitled Post',
      content: newPost.content || '',
      status: (newPost.status as PostStatus) || 'draft',
      category: newPost.category || categories[0] || 'Uncategorized',
      tags: Array.isArray(newPost.tags) ? newPost.tags : [],
      featured_image: newPost.featuredImage,
      meta_title: newPost.seo?.metaTitle || '',
      meta_description: newPost.seo?.metaDescription || '',
      focus_keyword: newPost.seo?.focusKeyword || '',
      slug: newPost.seo?.slug || '',
      scheduled_at: newPost.scheduledAt || format(new Date(), 'yyyy-MM-dd'),
    };

    const { data, error } = await supabase
      .from('posts')
      .insert([postData])
      .select()
      .single();

    if (data) {
      const mappedPost: BlogPost = {
        id: data.id,
        title: data.title,
        content: data.content,
        status: data.status as PostStatus,
        category: data.category,
        tags: data.tags || [],
        featuredImage: data.featured_image,
        seo: {
          metaTitle: data.meta_title || '',
          metaDescription: data.meta_description || '',
          focusKeyword: data.focus_keyword || '',
          slug: data.slug || ''
        },
        scheduledAt: data.scheduled_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
      setPosts([mappedPost, ...posts]);
      setCurrentScreen('posts');
    } else if (error) {
      console.error('Error creating post:', error);
      alert('Failed to create post');
    }
  };

  const handleUpdatePost = async (updatedPost: Omit<BlogPost, 'createdAt' | 'updatedAt'>) => {
    const postData = {
      title: updatedPost.title,
      content: updatedPost.content,
      status: updatedPost.status,
      category: updatedPost.category,
      tags: updatedPost.tags,
      featured_image: updatedPost.featuredImage,
      meta_title: updatedPost.seo?.metaTitle,
      meta_description: updatedPost.seo?.metaDescription,
      focus_keyword: updatedPost.seo?.focusKeyword,
      slug: updatedPost.seo?.slug,
      scheduled_at: updatedPost.scheduledAt,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('posts')
      .update(postData)
      .eq('id', updatedPost.id);

    if (!error) {
      setPosts(posts.map(p => p.id === updatedPost.id ? { 
        ...p, 
        ...updatedPost, 
        updatedAt: postData.updated_at 
      } : p));
      setCurrentScreen('posts');
      setEditingPostId(null);
    } else {
      console.error('Error updating post:', error);
      alert('Failed to update post');
    }
  };

  const handleEditPost = (id: string) => {
    setEditingPostId(id);
    setCurrentScreen('edit-post');
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id);

    if (!error) {
      setPosts(posts.filter(p => p.id !== id));
      if (currentScreen === 'edit-post') {
        setCurrentScreen('posts');
        setEditingPostId(null);
      }
    } else {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
    }
  };

  const filteredPosts = posts.filter(post => {
    const query = searchQuery.toLowerCase();
    const title = (post.title || '').toLowerCase();
    const content = (post.content || '').toLowerCase();
    
    const matchesSearch = title.includes(query) || content.includes(query);
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || post.category === categoryFilter;
    
    // Date range filter
    const postDate = new Date(post.createdAt || new Date());
    const matchesStartDate = !dateRange.start || postDate >= new Date(dateRange.start);
    const matchesEndDate = !dateRange.end || postDate <= new Date(dateRange.end);
    
    // Multiple tags filter (must have all selected tags)
    const postTags = Array.isArray(post.tags) ? post.tags : [];
    const matchesTags = selectedTags.length === 0 || 
                       selectedTags.every(tag => postTags.includes(tag));

    return matchesSearch && matchesStatus && matchesCategory && matchesStartDate && matchesEndDate && matchesTags;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 size={40} className="animate-spin text-indigo-600 mx-auto" />
          <p className="text-slate-500 font-medium">Loading Softrify...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-right border-slate-200 flex flex-col transition-all duration-300 ease-in-out relative",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}>
        <div className={cn(
          "p-6 border-bottom border-slate-100 flex items-center justify-between",
          isSidebarCollapsed && "px-4"
        )}>
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex-shrink-0 flex items-center justify-center text-white">
              <SoftrifyLogo size={20} />
            </div>
            {!isSidebarCollapsed && (
              <motion.h1 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="font-bold text-xl tracking-tight text-slate-900 whitespace-nowrap"
              >
                Softrify
              </motion.h1>
            )}
          </div>
        </div>

        {/* Collapse Toggle Button */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 shadow-sm z-50 transition-all"
        >
          {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-hide">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={currentScreen === 'dashboard'} 
            onClick={() => setCurrentScreen('dashboard')} 
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            icon={<FileText size={20} />} 
            label="Blog Posts" 
            active={currentScreen === 'posts'} 
            onClick={() => setCurrentScreen('posts')} 
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            icon={<PlusCircle size={20} />} 
            label="New Post" 
            active={currentScreen === 'new-post'} 
            onClick={() => setCurrentScreen('new-post')} 
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            icon={<Tags size={20} />} 
            label="Categories" 
            active={currentScreen === 'categories'} 
            onClick={() => setCurrentScreen('categories')} 
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            icon={<CalendarIcon size={20} />} 
            label="Calendar" 
            active={currentScreen === 'calendar'} 
            onClick={() => setCurrentScreen('calendar')} 
            collapsed={isSidebarCollapsed}
          />
          <NavItem 
            icon={<Sparkles size={20} />} 
            label="AI Generator" 
            active={currentScreen === 'ai-generator'} 
            onClick={() => setCurrentScreen('ai-generator')} 
            collapsed={isSidebarCollapsed}
          />
          <div className="pt-4 mt-4 border-t border-slate-100">
            <NavItem 
              icon={<MessageSquare size={20} />} 
              label="Feedback" 
              active={currentScreen === 'feedback'} 
              onClick={() => setCurrentScreen('feedback')} 
              collapsed={isSidebarCollapsed}
            />
          </div>
        </nav>

        <div className="p-4 border-top border-slate-100">
          <div 
            onClick={() => setCurrentScreen('profile')}
            className={cn(
              "flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors overflow-hidden",
              isSidebarCollapsed && "justify-center px-0",
              currentScreen === 'profile' && "bg-slate-50"
            )}
          >
            <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center">
              <User size={20} className="text-slate-500" />
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold text-slate-900 truncate">{user?.name || 'User'}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-bottom border-slate-200 flex items-center justify-between px-8">
          <div className="flex items-center gap-8 flex-1">
            <h2 className="text-lg font-semibold text-slate-900 hidden lg:block">
              {currentScreen === 'dashboard' && 'Dashboard'}
              {currentScreen === 'posts' && 'All Posts'}
              {currentScreen === 'new-post' && 'New Masterpiece'}
              {currentScreen === 'edit-post' && 'Edit Post'}
              {currentScreen === 'categories' && 'Manage Categories'}
              {currentScreen === 'calendar' && 'Content Calendar'}
              {currentScreen === 'profile' && 'Profile Settings'}
            </h2>
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search posts..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentScreen('new-post')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            >
              <PlusCircle size={18} />
              Create Post
            </button>
          </div>
        </header>

        {/* Screen Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {currentScreen === 'dashboard' && (
              <DashboardScreen 
                key="dashboard" 
                stats={stats} 
                recentPosts={posts.slice(0, 3)} 
                onEdit={handleEditPost}
              />
            )}
            {currentScreen === 'posts' && (
              <PostsScreen 
                key="posts" 
                posts={filteredPosts} 
                onDelete={handleDeletePost}
                onEdit={handleEditPost}
                onNewPost={() => setCurrentScreen('new-post')}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                categoryFilter={categoryFilter}
                setCategoryFilter={setCategoryFilter}
                categories={categories}
                dateRange={dateRange}
                setDateRange={setDateRange}
                selectedTags={selectedTags}
                setSelectedTags={setSelectedTags}
                allTags={allTags}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}
            {currentScreen === 'new-post' && (
              <PostFormScreen 
                key="new-post" 
                onSubmit={handleCreatePost} 
                categories={categories}
              />
            )}
            {currentScreen === 'edit-post' && editingPostId && (
              <PostFormScreen 
                key="edit-post" 
                post={posts.find(p => p.id === editingPostId)} 
                onSubmit={handleUpdatePost}
                onDelete={handleDeletePost}
                categories={categories}
              />
            )}
            {currentScreen === 'categories' && (
              <CategoriesScreen 
                key="categories" 
                categories={categories} 
                setCategories={setCategories} 
              />
            )}
            {currentScreen === 'calendar' && (
              <CalendarScreen 
                key="calendar" 
                posts={posts} 
                onReschedule={(id, date) => {
                  setPosts(posts.map(p => p.id === id ? { ...p, scheduledAt: format(date, 'yyyy-MM-dd'), updatedAt: new Date().toISOString() } : p));
                }}
                onEdit={handleEditPost}
              />
            )}
            {currentScreen === 'ai-generator' && (
              <AIGeneratorScreen 
                key="ai-generator"
                categories={categories}
                onAccept={(post) => {
                  handleCreatePost(post);
                }}
              />
            )}
            {currentScreen === 'feedback' && user && (
              <FeedbackScreen user={user} />
            )}
            {currentScreen === 'profile' && user && (
              <ProfileScreen 
                key="profile"
                user={user}
                onUpdate={(updatedUser) => {
                  setUser(updatedUser);
                }}
                onLogout={async () => {
                  await supabase.auth.signOut();
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function FeedbackScreen({ user }: { user: { id: string } }) {
  const [type, setType] = useState<'bug' | 'feature' | 'general'>('general');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('feedback')
        .insert([{
          user_id: user.id,
          type,
          message
        }]);

      if (error) throw error;
      
      setSubmitted(true);
      setMessage('');
    } catch (err) {
      console.error('Error submitting feedback:', err);
      alert('Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-xl mx-auto mt-12 text-center space-y-6"
      >
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-100">
          <CheckCircle2 size={40} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">Thank You!</h2>
          <p className="text-slate-500">Your feedback has been received. We appreciate your help in making Softrify better.</p>
        </div>
        <button 
          onClick={() => setSubmitted(false)}
          className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
        >
          Send More Feedback
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto"
    >
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <MessageSquare size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Send Feedback</h3>
              <p className="text-slate-500 text-sm">Help us improve Softrify Blog Writer.</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Feedback Type</label>
              <div className="grid grid-cols-3 gap-3">
                {(['general', 'bug', 'feature'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "py-3 px-4 rounded-xl text-sm font-bold border transition-all capitalize",
                      type === t 
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" 
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Your Message</label>
              <textarea 
                required
                placeholder="Tell us what's on your mind..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all h-48 resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <button 
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Submit Feedback
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}

function ProfileScreen({ user, onUpdate, onLogout }: { 
  user: { id: string, name: string, email: string }, 
  onUpdate: (user: any) => void,
  onLogout: () => void 
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess(false);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name, email })
        .eq('id', user.id);

      if (error) throw error;
      
      onUpdate({ ...user, name, email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto"
    >
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <User size={40} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">{user.name}</h3>
              <p className="text-slate-500">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium">
                {error}
              </div>
            )}
            {success && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-xl font-medium flex items-center gap-2">
                <CheckCircle2 size={18} />
                Profile updated successfully!
              </div>
            )}

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email" 
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button 
                type="submit"
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>

              <button 
                type="button"
                onClick={onLogout}
                className="flex items-center gap-2 px-6 py-3 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-all"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  );
}

function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name
            }
          }
        });
        
        if (signUpError) throw signUpError;
        
        // Note: Profile is now created automatically by the DB trigger
        if (isLogin === false) {
          alert('Check your email for the confirmation link!');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden"
      >
        <div className="p-8 text-center bg-indigo-600 text-white">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <SoftrifyLogo size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold">Softrify</h1>
          <p className="text-indigo-100 text-sm mt-1">
            {isLogin ? 'Welcome back! Please login to your account.' : 'Create an account to start writing.'}
          </p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl text-center font-medium">
                {error}
              </div>
            )}
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    required
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" 
                  required
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Please wait...
                </>
              ) : (
                isLogin ? 'Login to Dashboard' : 'Create Account'
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
              >
                {isLogin ? 'Sign Up' : 'Login'}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void, collapsed?: boolean }) {
  return (
    <button 
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
        active 
          ? "bg-indigo-50 text-indigo-700" 
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
        collapsed && "justify-center px-0"
      )}
    >
      <span className={cn("flex-shrink-0", active ? "text-indigo-600" : "text-slate-400")}>{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

function FilterButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
        active 
          ? "bg-slate-100 text-slate-900 shadow-sm" 
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
      )}
    >
      {label}
    </button>
  );
}

function DashboardScreen({ stats, recentPosts, onEdit }: { stats: any, recentPosts: BlogPost[], onEdit: (id: string) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
        <p className="text-slate-500">Welcome back! Here's what's happening with your blog.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Posts" value={stats.total} icon={<FileText className="text-blue-600" />} color="blue" />
        <StatCard label="Published" value={stats.published} icon={<CheckCircle2 className="text-emerald-600" />} color="emerald" />
        <StatCard label="Drafts" value={stats.drafts} icon={<Clock className="text-amber-600" />} color="amber" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-bottom border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Recent Activity</h3>
          <button className="text-sm text-indigo-600 font-medium hover:text-indigo-700">View all</button>
        </div>
        <div className="divide-y divide-slate-100">
          {recentPosts.map(post => (
            <div 
              key={post.id} 
              onClick={() => onEdit(post.id)}
              className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  post.status === 'published' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                )}>
                  {post.status === 'published' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-900">{post.title || 'Untitled Post'}</h4>
                  <p className="text-xs text-slate-500">{format(new Date(post.createdAt || new Date()), 'MMM d, yyyy')}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-100",
    emerald: "bg-emerald-50 border-emerald-100",
    amber: "bg-amber-50 border-amber-100",
  }[color as 'blue' | 'emerald' | 'amber'];

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2 rounded-lg border", colorClasses)}>
          {icon}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="text-3xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function PostsScreen({ 
  posts, 
  onDelete, 
  onEdit,
  onNewPost, 
  statusFilter, 
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  categories,
  dateRange,
  setDateRange,
  selectedTags,
  setSelectedTags,
  allTags,
  searchQuery,
  setSearchQuery
}: { 
  posts: BlogPost[], 
  onDelete: (id: string) => void, 
  onEdit: (id: string) => void,
  onNewPost: () => void,
  statusFilter: 'all' | PostStatus,
  setStatusFilter: (filter: 'all' | PostStatus) => void,
  categoryFilter: string,
  setCategoryFilter: (category: string) => void,
  categories: string[],
  dateRange: { start: string, end: string },
  setDateRange: (range: { start: string, end: string }) => void,
  selectedTags: string[],
  setSelectedTags: (tags: string[]) => void,
  allTags: string[],
  searchQuery: string,
  setSearchQuery: (query: string) => void
}) {
  const [showFilters, setShowFilters] = useState(false);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setCategoryFilter('All');
    setDateRange({ start: '', end: '' });
    setSelectedTags([]);
    setSearchQuery('');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Blog Posts</h2>
          <p className="text-slate-500">Manage and edit your content.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "p-2 rounded-lg border transition-all flex items-center gap-2 text-sm font-medium",
              showFilters 
                ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <Filter size={18} />
            Filters
            {(statusFilter !== 'all' || categoryFilter !== 'All' || dateRange.start || dateRange.end || selectedTags.length > 0) && (
              <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
            )}
          </button>
          <button 
            onClick={onNewPost}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
          >
            <PlusCircle size={18} />
            New Post
          </button>
        </div>
      </div>

      {/* Search and Quick Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by title or content..." 
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-fit">
          <FilterButton 
            label="All" 
            active={statusFilter === 'all'} 
            onClick={() => setStatusFilter('all')} 
          />
          <FilterButton 
            label="Published" 
            active={statusFilter === 'published'} 
            onClick={() => setStatusFilter('published')} 
          />
          <FilterButton 
            label="Drafts" 
            active={statusFilter === 'draft'} 
            onClick={() => setStatusFilter('draft')} 
          />
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-8">
              <div className="flex flex-col lg:flex-row gap-8 lg:items-start">
                {/* Category Filter */}
                <div className="w-full lg:w-1/4 space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Category</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer pr-10"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <option value="All">All Categories</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronRight size={16} className="rotate-90" />
                    </div>
                  </div>
                </div>

                {/* Date Range Filter */}
                <div className="w-full lg:w-1/3 space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Date Range</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <input 
                        type="date" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      />
                    </div>
                    <div className="h-px w-3 bg-slate-200 flex-shrink-0"></div>
                    <div className="flex-1">
                      <input 
                        type="date" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Tags Filter */}
                <div className="w-full lg:flex-1 space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Filter by Tags</label>
                  <div className="flex flex-wrap gap-2 min-h-[44px] p-1">
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border",
                          selectedTags.includes(tag)
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-100"
                            : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                        )}
                      >
                        #{tag}
                      </button>
                    ))}
                    {allTags.length === 0 && <span className="text-xs text-slate-400 italic">No tags found</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <div className="text-xs text-slate-400">
                  {posts.length} posts found matching your criteria
                </div>
                <button 
                  onClick={clearFilters}
                  className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-2 uppercase tracking-wider"
                >
                  <X size={14} />
                  Clear Filters
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-bottom border-slate-200">
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">Image</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Created</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {posts.length > 0 ? posts.map(post => (
              <tr key={post.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                    {post.featuredImage ? (
                      <img 
                        src={post.featuredImage} 
                        alt="" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ImageIcon size={20} className="text-slate-300" />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 cursor-pointer" onClick={() => onEdit(post.id)}>
                  <div className="font-medium text-slate-900">{post.title || 'Untitled Post'}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(post.tags || []).map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">#{tag}</span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-600">{post.category}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
                    post.status === 'published' 
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                      : "bg-amber-50 text-amber-700 border border-amber-100"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", post.status === 'published' ? "bg-emerald-500" : "bg-amber-500")}></span>
                    {post.status ? (post.status.charAt(0).toUpperCase() + post.status.slice(1)) : 'Draft'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {format(new Date(post.createdAt), 'MMM d, yyyy')}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onEdit(post.id)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      <FileEdit size={18} />
                    </button>
                    <button 
                      onClick={() => onDelete(post.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No posts found. Create your first post!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function PostFormScreen({ 
  post, 
  onSubmit, 
  onDelete,
  categories
}: { 
  post?: BlogPost, 
  onSubmit: (post: any) => void,
  onDelete?: (id: string) => void,
  categories: string[]
}) {
  const [title, setTitle] = useState(post?.title || '');
  const [content, setContent] = useState(post?.content || '');
  const [category, setCategory] = useState(post?.category || categories[0]);
  const [tags, setTags] = useState<string[]>(post?.tags || []);
  const [featuredImage, setFeaturedImage] = useState<string | undefined>(post?.featuredImage);
  const [scheduledAt, setScheduledAt] = useState<string>(post?.scheduledAt || format(new Date(), 'yyyy-MM-dd'));
  const [seo, setSeo] = useState({
    metaTitle: post?.seo?.metaTitle || '',
    metaDescription: post?.seo?.metaDescription || '',
    focusKeyword: post?.seo?.focusKeyword || '',
    slug: post?.seo?.slug || ''
  });
  const [isPreview, setIsPreview] = useState(false);
  const [isGeneratingMeta, setIsGeneratingMeta] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const handleGenerateImage = async () => {
    if (!title.trim()) {
      alert("Please provide a title first to generate a relevant image.");
      return;
    }

    setIsGeneratingImage(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            {
              text: `Generate a high-quality, professional featured image for a blog post titled: "${title}". 
              The image should be visually appealing, modern, and relevant to the topic. 
              Avoid text in the image. Style: Professional photography or high-end digital illustration.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          },
        },
      });

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64EncodeString = part.inlineData.data;
            setFeaturedImage(`data:image/png;base64,${base64EncodeString}`);
            break;
          }
        }
      }
    } catch (error) {
      console.error("Image generation failed:", error);
      alert("Failed to generate image.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGenerateMeta = async () => {
    if (!title.trim() || !content.trim()) {
      alert("Please provide a title and some content first.");
      return;
    }
    
    setIsGeneratingMeta(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this blog post and generate SEO metadata.
        Title: ${title}
        Content: ${content}
        
        Requirements for SEO metadata:
        - metaTitle: Length must be between 50 and 60 characters.
        - metaDescription: Length must be between 50 and 160 characters (ideally 155-160).
        
        Return a JSON object with: metaTitle, metaDescription, focusKeyword, slug.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              metaTitle: { type: Type.STRING },
              metaDescription: { type: Type.STRING },
              focusKeyword: { type: Type.STRING },
              slug: { type: Type.STRING }
            },
            required: ["metaTitle", "metaDescription", "focusKeyword", "slug"]
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setSeo({
        metaTitle: data.metaTitle || '',
        metaDescription: data.metaDescription || '',
        focusKeyword: data.focusKeyword || '',
        slug: data.slug || ''
      });
    } catch (error) {
      console.error("Meta generation failed:", error);
      alert("Failed to generate SEO metadata.");
    } finally {
      setIsGeneratingMeta(false);
    }
  };

  const handleSubmit = (status: PostStatus) => {
    if (!title.trim() || !content.trim()) return;
    if (post) {
      onSubmit({ ...post, title, content, status, category, tags, seo, featuredImage, scheduledAt });
    } else {
      onSubmit({ title, content, status, category, tags, seo, featuredImage, scheduledAt });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFeaturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownloadImage = async () => {
    if (!featuredImage) return;
    
    try {
      // If it's already a data URL (base64), we can just download it directly
      if (featuredImage.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = featuredImage;
        link.download = `blog-image-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // If it's an external URL, fetch it as a blob to bypass browser "open in new tab" behavior
      const response = await fetch(featuredImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `blog-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback: try opening in new tab if fetch fails (CORS)
      window.open(featuredImage, '_blank');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {post ? 'Edit Post' : 'Create New Post'}
          </h2>
          <p className="text-slate-500">
            {post ? 'Update your content and settings.' : 'Draft your next masterpiece.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {post && onDelete && (
            <button 
              onClick={() => onDelete(post.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all mr-2"
              title="Delete Post"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button 
            onClick={() => setIsPreview(!isPreview)}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          >
            {isPreview ? 'Back to Editor' : 'Preview'}
          </button>
          <button 
            onClick={() => handleSubmit('draft')}
            className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all"
          >
            {post ? 'Save as Draft' : 'Save as Draft'}
          </button>
          <button 
            onClick={() => handleSubmit('published')}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-sm"
          >
            {post ? 'Update Post' : 'Publish Post'}
          </button>
        </div>
      </div>

      {/* AI Agents Panel */}
      {!isPreview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* AI Meta Agent */}
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe size={20} className="text-indigo-400" />
                <h3 className="font-semibold">AI SEO Agent</h3>
              </div>
              <button 
                onClick={handleGenerateMeta}
                disabled={isGeneratingMeta}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isGeneratingMeta ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Optimize Metadata
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Let the AI analyze your content to generate the perfect meta title, description, and focus keywords.
            </p>
          </div>

          {/* AI Image Agent */}
          <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-lg border border-indigo-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon size={20} className="text-indigo-300" />
                <h3 className="font-semibold">AI Image Agent</h3>
              </div>
              <button 
                onClick={handleGenerateImage}
                disabled={isGeneratingImage}
                className="bg-white text-indigo-900 hover:bg-indigo-50 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isGeneratingImage ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Painting...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Generate Image
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-indigo-200/70">
              Create a stunning, unique featured image based on your post title using generative AI.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {/* Main Content Editor */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isPreview ? (
            <div className="p-8 prose prose-slate max-w-none">
              {featuredImage && (
                <div className="relative group mb-8">
                  <img 
                    src={featuredImage} 
                    alt="Featured" 
                    className="w-full h-64 object-cover rounded-xl"
                    referrerPolicy="no-referrer"
                  />
                  <button 
                    onClick={handleDownloadImage}
                    className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-slate-900 p-2.5 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-white flex items-center gap-2 text-xs font-bold"
                    title="Download Image"
                  >
                    <Download size={16} />
                    Download
                  </button>
                </div>
              )}
              <h1 className="text-3xl font-bold mb-6">{title || 'Untitled Post'}</h1>
              <div dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          ) : (
            <div className="p-8 space-y-6">
              {/* Featured Image Upload */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Featured Image</label>
                {featuredImage ? (
                  <div className="relative group aspect-video w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200">
                    <img 
                      src={featuredImage} 
                      alt="Featured" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <label className="cursor-pointer bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                        Change Image
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                      </label>
                      <button 
                        onClick={handleDownloadImage}
                        className="bg-white text-slate-900 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                        title="Download Image"
                      >
                        <Download size={18} />
                      </button>
                      <button 
                        onClick={() => setFeaturedImage(undefined)}
                        className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full aspect-video max-w-2xl border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <div className="p-3 bg-slate-100 rounded-full text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors mb-3">
                        <Upload size={24} />
                      </div>
                      <p className="mb-1 text-sm text-slate-600 font-medium">Click to upload featured image</p>
                      <p className="text-xs text-slate-400">PNG, JPG or WebP (Recommended 1200x630)</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Post Title</label>
                <input 
                  type="text" 
                  placeholder="Enter a catchy title..." 
                  className="w-full text-3xl font-bold text-slate-900 placeholder:text-slate-300 border-none focus:ring-0 p-0"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="h-px bg-slate-100"></div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Content</label>
                <RichTextEditor content={content} onChange={setContent} />
              </div>
            </div>
          )}
        </div>

        {!isPreview && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Classification Section */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-4">
                <Tags size={20} className="text-indigo-600" />
                <span>Classification</span>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tags</label>
                  <TagInput tags={tags} onChange={setTags} />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Schedule Publication</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* SEO Section */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center gap-2 text-slate-900 font-bold border-b border-slate-100 pb-4">
                <Globe size={20} className="text-indigo-600" />
                <span>SEO Optimization</span>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Meta Title</label>
                  <input 
                    type="text" 
                    placeholder="SEO Title..." 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={seo.metaTitle}
                    onChange={(e) => setSeo({ ...seo, metaTitle: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">URL Slug</label>
                  <input 
                    type="text" 
                    placeholder="post-url-slug" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={seo.slug}
                    onChange={(e) => setSeo({ ...seo, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Focus Keyword</label>
                  <input 
                    type="text" 
                    placeholder="Main keyword..." 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={seo.focusKeyword}
                    onChange={(e) => setSeo({ ...seo, focusKeyword: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* SEO Description & Preview (Full Width) */}
            <div className="md:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Meta Description</label>
                  <textarea 
                    placeholder="SEO Description..." 
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-32 resize-none"
                    value={seo.metaDescription}
                    onChange={(e) => setSeo({ ...seo, metaDescription: e.target.value })}
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Search Engine Preview</label>
                  <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
                      <SearchIcon size={12} />
                      <span>Google Search Preview</span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-blue-700 text-lg font-medium hover:underline cursor-pointer truncate">
                        {seo.metaTitle || title || 'Untitled Post'}
                      </div>
                      <div className="text-emerald-700 text-xs truncate">
                        https://softrify.ai/{seo.slug || title.toLowerCase().replace(/\s+/g, '-')}
                      </div>
                      <div className="text-slate-600 text-sm line-clamp-2 leading-relaxed">
                        {seo.metaDescription || 'No description provided yet. Add a meta description to see how it looks in search results.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {post && !isPreview && (
          <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-400">
            <div className="flex gap-8">
              <div className="flex gap-2">
                <span className="font-semibold text-slate-500">Created:</span>
                <span>{format(new Date(post.createdAt), 'MMMM d, yyyy HH:mm')}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-semibold text-slate-500">Last Updated:</span>
                <span>{format(new Date(post.updatedAt), 'MMMM d, yyyy HH:mm')}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="font-semibold text-slate-500">ID:</span>
              <span className="font-mono">{post.id}</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TagInput({ tags, onChange }: { tags: string[], onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = input.trim().replace(/,/g, '');
      if (newTag && !tags.includes(newTag)) {
        onChange([...tags, newTag]);
      }
      setInput('');
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <span 
            key={tag} 
            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg border border-indigo-100"
          >
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:text-indigo-900">
              <Trash2 size={12} />
            </button>
          </span>
        ))}
      </div>
      <input 
        type="text" 
        placeholder="Add tags..." 
        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <p className="text-[10px] text-slate-400 italic">Press Enter or comma to add tags</p>
    </div>
  );
}

function CategoriesScreen({ categories, setCategories }: { categories: string[], setCategories: (categories: string[]) => void }) {
  const [newCategory, setNewCategory] = useState('');

  const handleAddCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (catToRemove: string) => {
    setCategories(categories.filter(cat => cat !== catToRemove));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto space-y-8"
    >
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Manage Categories</h2>
        <p className="text-slate-500">Add or remove categories for your blog posts.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex gap-3">
          <input 
            type="text" 
            placeholder="New category name..." 
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
          />
          <button 
            onClick={handleAddCategory}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
          >
            <PlusCircle size={18} />
            Add Category
          </button>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
          {categories.map(cat => (
            <div key={cat} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <span className="font-medium text-slate-700">{cat}</span>
              <button 
                onClick={() => handleRemoveCategory(cat)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="p-8 text-center text-slate-400 italic">
              No categories defined yet.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CalendarScreen({ 
  posts, 
  onReschedule,
  onEdit
}: { 
  posts: BlogPost[], 
  onReschedule: (id: string, date: Date) => void,
  onEdit: (id: string) => void
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const handleDragStart = (e: React.DragEvent, postId: string) => {
    e.dataTransfer.setData('postId', postId);
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const postId = e.dataTransfer.getData('postId');
    if (postId) {
      onReschedule(postId, date);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{format(currentMonth, 'MMMM yyyy')}</h2>
          <p className="text-slate-500">Plan and schedule your content releases.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button 
            onClick={prevMonth}
            className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-600"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1.5 text-sm font-medium hover:bg-slate-50 rounded-lg transition-colors text-slate-600"
          >
            Today
          </button>
          <button 
            onClick={nextMonth}
            className="p-2 hover:bg-slate-50 rounded-lg transition-colors text-slate-600"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[120px]">
          {calendarDays.map((day, idx) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayPosts = posts.filter(p => {
              const createdAt = p.createdAt || new Date().toISOString();
              const postDateStr = p.scheduledAt || format(parseISO(createdAt), 'yyyy-MM-dd');
              return postDateStr === dayStr;
            });

            return (
              <div 
                key={idx}
                onDrop={(e) => handleDrop(e, day)}
                onDragOver={handleDragOver}
                className={clsx(
                  "border-r border-b border-slate-100 p-2 transition-colors",
                  !isSameMonth(day, monthStart) ? "bg-slate-50/50" : "bg-white",
                  isSameDay(day, new Date()) && "bg-indigo-50/30"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={clsx(
                    "text-xs font-medium",
                    !isSameMonth(day, monthStart) ? "text-slate-300" : "text-slate-500",
                    isSameDay(day, new Date()) && "text-indigo-600 font-bold"
                  )}>
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="space-y-1 overflow-y-auto max-h-[85px] scrollbar-hide">
                  {dayPosts.map(post => (
                    <div 
                      key={post.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, post.id)}
                      onClick={() => onEdit(post.id)}
                      className={clsx(
                        "px-2 py-1 rounded text-[10px] font-medium truncate cursor-pointer transition-all border",
                        post.status === 'published' 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                          : "bg-amber-50 text-amber-700 border-amber-100"
                      )}
                      title={post.title || 'Untitled Post'}
                    >
                      {post.title || 'Untitled Post'}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function AIGeneratorScreen({ categories, onAccept }: { categories: string[], onAccept: (post: any) => void }) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPost, setGeneratedPost] = useState<any>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a high-quality, SEO-friendly blog post based on this prompt: "${prompt}".
        
        Requirements:
        1. Use proper HTML structure with H1, H2, and H3 headers for SEO.
        2. Content should be informative and engaging.
        3. Include lists and bold text where appropriate.
        
        Return a JSON object with:
        - title: Catchy SEO title
        - content: Full HTML content
        - category: One of [${categories.join(', ')}]
        - tags: Array of 3-5 relevant tags`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              category: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "content", "category", "tags"]
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      setGeneratedPost(data);
    } catch (error) {
      console.error("AI Generation failed:", error);
      alert("Failed to generate content.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="text-center space-y-4">
        <div className="inline-flex p-3 bg-indigo-100 text-indigo-600 rounded-2xl mb-2">
          <Sparkles size={32} />
        </div>
        <h2 className="text-3xl font-bold text-slate-900">AI Post Generator</h2>
        <p className="text-slate-500 max-w-lg mx-auto">
          Describe your topic and let our AI agent craft a high-quality, SEO-optimized blog post for you.
        </p>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 space-y-6">
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">What should we write about?</label>
          <textarea 
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[120px] resize-none"
            placeholder="e.g. A comprehensive guide to sustainable gardening in urban environments..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        <button 
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 size={24} className="animate-spin" />
              Crafting your story...
            </>
          ) : (
            <>
              <Sparkles size={24} />
              Generate Post
            </>
          )}
        </button>
      </div>

      <AnimatePresence>
        {generatedPost && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Content Ready</h3>
                  <p className="text-xs text-slate-500">Review the generated draft below.</p>
                </div>
              </div>
              <button 
                onClick={() => onAccept(generatedPost)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-100 transition-all"
              >
                Accept & Create Post
              </button>
            </div>
            <div className="p-10 prose prose-slate max-w-none">
              <h1 className="text-4xl font-black text-slate-900 mb-8 leading-tight">{generatedPost.title}</h1>
              <div dangerouslySetInnerHTML={{ __html: generatedPost.content }} />
              <div className="mt-12 pt-8 border-t border-slate-100 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
                  <Tags size={14} />
                  {generatedPost.category}
                </div>
                {generatedPost.tags.map((tag: string) => (
                  <span key={tag} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RichTextEditor({ content, onChange }: { content: string, onChange: (content: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing your story...',
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[400px] leading-relaxed',
      },
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-slate-50 border-bottom border-slate-200 p-2 flex flex-wrap gap-1">
        <EditorToolbarButton 
          onClick={() => editor.chain().focus().toggleBold().run()} 
          active={editor.isActive('bold')}
          icon={<Bold size={18} />}
        />
        <EditorToolbarButton 
          onClick={() => editor.chain().focus().toggleItalic().run()} 
          active={editor.isActive('italic')}
          icon={<Italic size={18} />}
        />
        <div className="w-px h-6 bg-slate-200 mx-1 self-center" />
        <EditorToolbarButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
          active={editor.isActive('heading', { level: 1 })}
          icon={<Heading1 size={18} />}
        />
        <EditorToolbarButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
          active={editor.isActive('heading', { level: 2 })}
          icon={<Heading2 size={18} />}
        />
        <div className="w-px h-6 bg-slate-200 mx-1 self-center" />
        <EditorToolbarButton 
          onClick={() => editor.chain().focus().toggleBulletList().run()} 
          active={editor.isActive('bulletList')}
          icon={<List size={18} />}
        />
        <EditorToolbarButton 
          onClick={() => editor.chain().focus().toggleOrderedList().run()} 
          active={editor.isActive('orderedList')}
          icon={<ListOrdered size={18} />}
        />
        <div className="w-px h-6 bg-slate-200 mx-1 self-center" />
        <EditorToolbarButton 
          onClick={() => editor.chain().focus().toggleBlockquote().run()} 
          active={editor.isActive('blockquote')}
          icon={<Quote size={18} />}
        />
        <EditorToolbarButton 
          onClick={() => editor.chain().focus().toggleCodeBlock().run()} 
          active={editor.isActive('codeBlock')}
          icon={<Code size={18} />}
        />
        <div className="flex-1" />
        <EditorToolbarButton 
          onClick={() => editor.chain().focus().undo().run()} 
          disabled={!editor.can().undo()}
          icon={<Undo size={18} />}
        />
        <EditorToolbarButton 
          onClick={() => editor.chain().focus().redo().run()} 
          disabled={!editor.can().redo()}
          icon={<Redo size={18} />}
        />
      </div>
      <div className="p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function EditorToolbarButton({ onClick, active, icon, disabled }: { onClick: () => void, active?: boolean, icon: React.ReactNode, disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-2 rounded-lg transition-all",
        active 
          ? "bg-indigo-100 text-indigo-700" 
          : "text-slate-600 hover:bg-slate-200 hover:text-slate-900",
        disabled && "opacity-30 cursor-not-allowed"
      )}
    >
      {icon}
    </button>
  );
}
