import { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard, ShoppingBasket, Refrigerator, ChefHat, Leaf, Plus, Search,
  Check, Trash2, Pencil, CalendarClock, Sparkles, ArrowRight, Clock3, CircleAlert,
  X, Menu, RefreshCw, CheckCircle2, PackageCheck, Heart, CookingPot, Sprout
} from 'lucide-react'

const seedInventory = [
  { id: 1, name: 'Tomatoes', qty: '500', unit: 'g', category: 'Vegetables', expiry: daysFromNow(2) },
  { id: 2, name: 'Potatoes', qty: '1', unit: 'kg', category: 'Vegetables', expiry: daysFromNow(8) },
  { id: 3, name: 'Milk', qty: '1', unit: 'litre', category: 'Dairy', expiry: daysFromNow(1) },
  { id: 4, name: 'Eggs', qty: '6', unit: 'pieces', category: 'Dairy', expiry: daysFromNow(5) },
]
function daysFromNow(days) { const d = new Date(); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const seedGroceries = [
  { id: 101, name: 'Onions', qty: '1', unit: 'kg', category: 'Vegetables', checked: false },
  { id: 102, name: 'Yogurt', qty: '500', unit: 'g', category: 'Dairy', checked: false },
  { id: 103, name: 'Fresh coriander', qty: '1', unit: 'bunch', category: 'Vegetables', checked: true },
]
const load = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback } }
const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }
function expiryStatus(date) {
  if (!date) return { label: 'No date set', cls: 'neutral', days: null }
  const d = new Date(`${date}T00:00:00`), diff = Math.round((d - today()) / 86400000)
  if (diff < 0) return { label: 'Expired', cls: 'expired', days: diff }
  if (diff === 0) return { label: 'Expires today', cls: 'urgent', days: diff }
  if (diff <= 3) return { label: `In ${diff} day${diff === 1 ? '' : 's'}`, cls: 'soon', days: diff }
  return { label: 'Fresh', cls: 'fresh', days: diff }
}
const fmtDate = d => d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : 'Not set'
const units = ['pieces', 'kg', 'g', 'litre', 'ml', 'packet', 'bunch', 'dozen']
const categories = ['Vegetables', 'Fruits', 'Dairy', 'Meat & seafood', 'Grains & rice', 'Bakery', 'Spices', 'Other']

export default function App() {
  const [page, setPage] = useState('Dashboard')
  const [inventory, setInventory] = useState(() => load('sk-inventory', seedInventory))
  const [groceries, setGroceries] = useState(() => load('sk-groceries', seedGroceries))
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [modal, setModal] = useState(null)
  const [draft, setDraft] = useState({ name: '', qty: '1', unit: 'pieces', category: 'Vegetables', expiry: '' })
  const [recipePrefs, setRecipePrefs] = useState({ meal: 'Any meal', time: '30 minutes or less', servings: '3' })
  const [recipes, setRecipes] = useState([])
  const [loadingRecipes, setLoadingRecipes] = useState(false)
  const [recipeError, setRecipeError] = useState('')
  const [apiMode, setApiMode] = useState('unknown')
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => { localStorage.setItem('sk-inventory', JSON.stringify(inventory)) }, [inventory])
  useEffect(() => { localStorage.setItem('sk-groceries', JSON.stringify(groceries)) }, [groceries])
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2800); return () => clearTimeout(t) } }, [toast])

  const activeGroceries = groceries.filter(x => !x.checked)
  const soonItems = inventory.filter(x => ['soon','urgent','expired'].includes(expiryStatus(x.expiry).cls))
  const expiredCount = inventory.filter(x => expiryStatus(x.expiry).cls === 'expired').length
  const filteredInventory = useMemo(() => inventory.filter(x => {
    const matchQ = x.name.toLowerCase().includes(query.toLowerCase())
    const status = expiryStatus(x.expiry).cls
    const matchF = filter === 'All' || (filter === 'Expiring soon' && ['soon','urgent'].includes(status)) || (filter === 'Expired' && status === 'expired') || x.category === filter
    return matchQ && matchF
  }).sort((a,b) => (expiryStatus(a.expiry).days ?? 9999) - (expiryStatus(b.expiry).days ?? 9999)), [inventory, query, filter])

  function openAdd(type) {
    setDraft({ name: '', qty: '1', unit: 'pieces', category: 'Vegetables', expiry: '' })
    setModal({ type })
  }
  function saveDraft(e) {
    e.preventDefault()
    if (!draft.name.trim() || !draft.qty || Number(draft.qty) <= 0) { setToast('Add an item name and a positive quantity.'); return }
    const item = { ...draft, name: draft.name.trim(), id: Date.now() }
    if (modal.type === 'inventory') setInventory(prev => [item, ...prev])
    else setGroceries(prev => [{ ...item, checked: false }, ...prev])
    setModal(null); setToast(`${item.name} added successfully.`)
  }
  function toggleGrocery(id) {
    const item = groceries.find(x => x.id === id)
    if (!item) return
    if (!item.checked) {
      setGroceries(prev => prev.map(x => x.id === id ? { ...x, checked: true } : x))
      setDraft({ name: item.name, qty: item.qty, unit: item.unit, category: item.category, expiry: '' })
      setModal({ type: 'purchase', itemId: id })
    } else {
      setGroceries(prev => prev.map(x => x.id === id ? { ...x, checked: false } : x))
      setToast('Item moved back to your shopping list.')
    }
  }
  function confirmPurchase(e) {
    e.preventDefault()
    const item = groceries.find(x => x.id === modal.itemId)
    if (!item) return setModal(null)
    setInventory(prev => [...prev, { ...draft, name: item.name, qty: item.qty, unit: item.unit, category: item.category, id: Date.now() }])
    setModal(null); setToast(`${item.name} moved to My Kitchen.`)
  }
  function removeInventory(id) { setInventory(prev => prev.filter(x => x.id !== id)); setToast('Ingredient removed.') }
  function removeGrocery(id) { setGroceries(prev => prev.filter(x => x.id !== id)); setToast('Grocery removed.') }

  async function generateRecipes() {
    setPage('AI Recipes'); setLoadingRecipes(true); setRecipeError(''); setRecipes([])
    try {
      const response = await fetch('http://127.0.0.1:8000/api/recipes/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: inventory.filter(x => Number(x.qty) > 0).map(x => ({ name: x.name, quantity: x.qty, unit: x.unit, expiry_date: x.expiry || null, expiry_status: expiryStatus(x.expiry).label })), meal_type: recipePrefs.meal, max_time: recipePrefs.time, servings: Number(recipePrefs.servings) })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Recipe service is not available.')
      setRecipes(data.recipes || [])
      if (!(data.recipes || []).length) setRecipeError('The AI could not find a suitable recipe from these ingredients. Try adding more ingredients.')
      setApiMode('connected')
    } catch (err) {
      setApiMode('offline')
      setRecipeError(`${err.message || 'Could not connect to the recipe API.'} Make sure the FastAPI backend is running and its API key is configured.`)
    } finally { setLoadingRecipes(false) }
  }

  const nav = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Grocery List', icon: ShoppingBasket },
    { name: 'My Kitchen', icon: Refrigerator },
    { name: 'AI Recipes', icon: ChefHat },
  ]
  const navigate = n => { setPage(n); setMobileNav(false); setQuery(''); setFilter('All') }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Sprout size={23}/></div><div><div className="brand-name">smart kitchen<span>.</span></div><div className="brand-caption">A little less waste, a lot more care</div></div><button className="icon-button mobile-close" onClick={() => setMobileNav(false)}><X size={18}/></button></div>
      <div className="home-label">YOUR HOME</div>
      <nav>{nav.map(({ name, icon: Icon }) => <button key={name} className={`nav-item ${page === name ? 'active' : ''}`} onClick={() => navigate(name)}><Icon size={19}/><span>{name}</span>{name === 'Grocery List' && activeGroceries.length > 0 && <span className="nav-count">{activeGroceries.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="tip-icon"><Leaf size={18}/></div><p><strong>A little reminder</strong><br/>Use what you have before buying more. Every ingredient counts.</p><div className="sidebar-foot">MADE WITH <Heart size={12} fill="currentColor"/> FOR AMMI</div></div>
    </aside>
    {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)}><Menu size={21}/></button><div className="breadcrumb">Smart Kitchen <span>/</span> <strong>{page}</strong></div><div className="topbar-right"><span className="today-label">{new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</span><div className="avatar">A</div><div className="profile-copy"><strong>Ammi's kitchen</strong><span>Home account</span></div></div></header>
      <div className="page-content">
        {page === 'Dashboard' && <Dashboard inventory={inventory} groceries={activeGroceries} soonItems={soonItems} expiredCount={expiredCount} navigate={navigate} openAdd={openAdd} generateRecipes={generateRecipes}/>}
        {page === 'Grocery List' && <section>
          <PageHeading eyebrow="SHOPPING, SIMPLIFIED" title="Grocery list" subtitle="Everything Ammi needs, all in one place." action={<button className="primary-btn" onClick={() => openAdd('grocery')}><Plus size={17}/> Add grocery</button>}/>
          <div className="list-toolbar"><div className="searchbox"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find an item..."/></div><span className="muted-small">{activeGroceries.length} left to buy · {groceries.filter(x=>x.checked).length} purchased</span></div>
          <div className="panel grocery-panel"><div className="panel-head"><div><h3>Your shopping checklist</h3><p>Tick an item when it goes in your basket.</p></div><span className="round-icon"><ShoppingBasket size={19}/></span></div>
            {groceries.filter(x=>x.name.toLowerCase().includes(query.toLowerCase())).length === 0 ? <EmptyState title="Your list is clear" text="Add the groceries you need for the next shop."/> :
              <div className="grocery-rows">{groceries.filter(x=>x.name.toLowerCase().includes(query.toLowerCase())).filter(x=>!x.checked).map(item=><GroceryRow key={item.id} item={item} toggle={toggleGrocery} remove={removeGrocery}/>)}
              {groceries.some(x=>x.checked && x.name.toLowerCase().includes(query.toLowerCase())) && <><div className="completed-label"><CheckCircle2 size={15}/> PURCHASED</div>{groceries.filter(x=>x.checked && x.name.toLowerCase().includes(query.toLowerCase())).map(item=><GroceryRow key={item.id} item={item} toggle={toggleGrocery} remove={removeGrocery}/>)}</>}</div>}
            <button className="add-inline" onClick={() => openAdd('grocery')}><Plus size={16}/> Add another item</button>
          </div>
          <div className="helper-note"><Leaf size={17}/><span><strong>Helpful tip</strong> Once you check off a grocery, we'll ask for its expiry date and move it into My Kitchen.</span></div>
        </section>}
        {page === 'My Kitchen' && <section>
          <PageHeading eyebrow="WHAT'S IN YOUR KITCHEN" title="My kitchen" subtitle="Know what you have before deciding what to cook." action={<button className="primary-btn" onClick={() => openAdd('inventory')}><Plus size={17}/> Add ingredient</button>}/>
          <div className="inventory-summary"><div><span>Available ingredients</span><strong>{inventory.length}</strong></div><div><span>Expiring soon</span><strong className="amber-text">{inventory.filter(x=>['soon','urgent'].includes(expiryStatus(x.expiry).cls)).length}</strong></div><div><span>Expired</span><strong className="red-text">{expiredCount}</strong></div></div>
          <div className="list-toolbar"><div className="searchbox"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search ingredients..."/></div><select className="filter-select" value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Expiring soon</option><option>Expired</option>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
          <div className="inventory-grid">{filteredInventory.map(item=><InventoryCard key={item.id} item={item} remove={removeInventory} useItem={() => {setPage('AI Recipes');setRecipePrefs(p=>({...p,meal:'Any meal'}));setToast(`${item.name} will be included in your available ingredients.`)}}/>)}{filteredInventory.length===0&&<EmptyState title="No ingredients found" text="Try another search or add an ingredient to your kitchen."/>}</div>
          <button className="secondary-btn" onClick={() => openAdd('inventory')}><Plus size={16}/> Add an ingredient</button>
        </section>}
        {page === 'AI Recipes' && <section>
          <PageHeading eyebrow="YOUR PERSONAL KITCHEN HELPER" title="What shall we cook?" subtitle="Discover recipes made for the ingredients you already have."/>
          <div className="recipe-hero"><div className="recipe-hero-copy"><span className="eyebrow light">LESS WASTE, MORE FLAVOUR</span><h2>Make something<br/><em>lovely today.</em></h2><p>We'll prioritise ingredients that need using soon.</p><div className="recipe-hero-tags"><span><Leaf size={14}/> Inventory-aware</span><span><Sparkles size={14}/> AI-powered</span></div></div><div className="recipe-hero-art"><div className="food-orb"><CookingPot size={70} strokeWidth={1.15}/><span>fresh & homemade</span></div></div></div>
          <div className="panel recipe-controls"><div className="panel-head"><div><h3>Recipe preferences</h3><p>Keep it simple. We'll do the thinking.</p></div><span className="round-icon"><Sparkles size={19}/></span></div>
            <div className="preferences-grid"><label>Meal<select value={recipePrefs.meal} onChange={e=>setRecipePrefs(p=>({...p,meal:e.target.value}))}><option>Any meal</option><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></label><label>Cooking time<select value={recipePrefs.time} onChange={e=>setRecipePrefs(p=>({...p,time:e.target.value}))}><option>15 minutes or less</option><option>30 minutes or less</option><option>45 minutes or less</option><option>Any time</option></select></label><label>Servings<select value={recipePrefs.servings} onChange={e=>setRecipePrefs(p=>({...p,servings:e.target.value}))}><option value="1">1 person</option><option value="2">2 people</option><option value="3">3 people</option><option value="4">4 people</option><option value="5">5+ people</option></select></label></div>
            <div className="ingredient-preview"><div><strong>Using your {inventory.length} available ingredients</strong><p>{inventory.slice(0,5).map(x=>x.name).join(' · ')}{inventory.length>5?' …':''}</p></div><button className="text-btn" onClick={()=>navigate('My Kitchen')}>Edit kitchen <ArrowRight size={15}/></button></div>
            <button className="primary-btn generate-btn" disabled={loadingRecipes || inventory.length===0} onClick={generateRecipes}>{loadingRecipes?<><RefreshCw size={17} className="spin"/> Finding recipes…</>:<><Sparkles size={17}/> Generate recipes with AI</>}</button>
            <p className="privacy-note"><CircleAlert size={14}/> Requires the FastAPI backend and a configured AI API key.</p>
          </div>
          {recipeError && <div className="error-banner"><CircleAlert size={18}/><div><strong>Couldn't generate recipes</strong><p>{recipeError}</p></div></div>}
          {recipes.length>0 && <div className="recipes-results"><div className="section-title"><div><span className="eyebrow">MADE FOR YOUR KITCHEN</span><h2>Today's recipe ideas</h2></div><span className="api-pill"><span/> Real AI response</span></div><div className="recipe-grid">{recipes.map((r,i)=><RecipeCard key={i} recipe={r}/>)}</div></div>}
          {loadingRecipes && <div className="loading-panel"><div className="loader-orb"><Sparkles size={24}/></div><h3>Finding something delicious…</h3><p>Checking your ingredients and prioritising anything that expires soon.</p></div>}
        </section>}
      </div>
      <footer className="footer"><span><Sprout size={15}/> Made with love for Ammi</span><span>Know what you have. Waste less.</span></footer>
    </main>
    {modal && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null)}}><div className="modal-card"><div className="modal-head"><div><span className="eyebrow">{modal.type==='purchase'?'GROCERY PURCHASE':'YOUR KITCHEN'}</span><h2>{modal.type==='purchase'?'Add expiry date':'Add '+(modal.type==='inventory'?'ingredient':'grocery')}</h2><p>{modal.type==='purchase'?'When does this item expire? You can leave it blank and add it later.':'A few details to keep everything organised.'}</p></div><button className="icon-button" onClick={()=>setModal(null)}><X size={19}/></button></div>
      <form onSubmit={modal.type==='purchase'?confirmPurchase:saveDraft}><label>Item name<input value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))} required disabled={modal.type==='purchase'}/></label><div className="form-row"><label>Quantity<input type="number" min="0.01" step="any" value={draft.qty} onChange={e=>setDraft(d=>({...d,qty:e.target.value}))} required/></label><label>Unit<select value={draft.unit} onChange={e=>setDraft(d=>({...d,unit:e.target.value}))}>{units.map(u=><option key={u}>{u}</option>)}</select></label></div><label>Category<select value={draft.category} onChange={e=>setDraft(d=>({...d,category:e.target.value}))}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>{(modal.type==='inventory'||modal.type==='purchase')&&<label>Expiry date <span className="optional">(optional)</span><input type="date" min="" value={draft.expiry} onChange={e=>setDraft(d=>({...d,expiry:e.target.value}))}/></label>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setModal(null)}>Cancel</button><button type="submit" className="primary-btn">{modal.type==='purchase'?'Add to My Kitchen': 'Save item'}</button></div></form></div></div>}
    {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}<button onClick={()=>setToast('')}><X size={15}/></button></div>}
  </div>
}

function PageHeading({eyebrow,title,subtitle,action}) { return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</div> }
function Dashboard({inventory,groceries,soonItems,expiredCount,navigate,openAdd,generateRecipes}) {
  const urgent = soonItems.slice(0,3)
  return <section>
    <div className="welcome-banner"><div className="welcome-copy"><span className="eyebrow light">THURSDAY, IN YOUR KITCHEN</span><h1>A little care,<br/><em>goes a long way.</em></h1><p>Good morning, Ammi. Let's make today a little easier.</p><button className="welcome-btn" onClick={()=>navigate('AI Recipes')}>What shall we cook? <ArrowRight size={16}/></button></div><div className="welcome-visual"><div className="sun-circle"/><div className="plant plant-one">✦</div><div className="plate"><div className="plate-inner"><Leaf size={62}/></div></div><div className="welcome-note">fresh starts here <Sprout size={15}/></div></div></div>
    <div className="section-title"><div><span className="eyebrow">YOUR KITCHEN AT A GLANCE</span><h2>Here's where things stand</h2></div><button className="text-btn" onClick={()=>navigate('My Kitchen')}>View kitchen <ArrowRight size={15}/></button></div>
    <div className="stats-grid"><StatCard icon={ShoppingBasket} label="To buy" value={groceries.length} note="on your shopping list" tint="sage" onClick={()=>navigate('Grocery List')}/><StatCard icon={Refrigerator} label="In your kitchen" value={inventory.length} note="available ingredients" tint="cream" onClick={()=>navigate('My Kitchen')}/><StatCard icon={CalendarClock} label="Use soon" value={soonItems.length} note="need a little attention" tint="amber" onClick={()=>navigate('My Kitchen')}/><StatCard icon={CircleAlert} label="Expired" value={expiredCount} note="check these ingredients" tint="rose" onClick={()=>navigate('My Kitchen')}/></div>
    <div className="dashboard-columns"><div className="panel"><div className="panel-head"><div><h3>Shopping list</h3><p>Little things to pick up</p></div><button className="round-icon clickable" onClick={()=>navigate('Grocery List')}><ArrowRight size={17}/></button></div>{groceries.slice(0,4).length===0?<EmptyState title="Nothing to buy" text="Your shopping list is all clear."/>:groceries.slice(0,4).map(g=><div className="mini-row" key={g.id}><span className="mini-checkbox"/><span>{g.name}</span><span className="mini-qty">{g.qty} {g.unit}</span></div>)}<button className="add-inline" onClick={()=>openAdd('grocery')}><Plus size={15}/> Add to grocery list</button></div>
    <div className="panel"><div className="panel-head"><div><h3>Use these soon</h3><p>Let's keep good food from going to waste</p></div><span className="round-icon amber"><CalendarClock size={18}/></span></div>{urgent.length===0?<div className="nice-empty"><Leaf size={20}/><span>Everything looks fresh for now.</span></div>:urgent.map(x=>{const s=expiryStatus(x.expiry);return <div className="expiring-row" key={x.id}><div className={`expiry-dot ${s.cls}`}/><div className="expiring-copy"><strong>{x.name}</strong><span>{s.label} · {x.qty} {x.unit}</span></div><button className="tiny-action" onClick={generateRecipes}>Use it <ArrowRight size={13}/></button></div>})}<button className="add-inline" onClick={()=>navigate('My Kitchen')}>View all ingredients <ArrowRight size={15}/></button></div></div>
    <div className="recipe-cta"><div className="cta-icon"><ChefHat size={24}/></div><div><span className="eyebrow">A LITTLE INSPIRATION</span><h3>What's already in your kitchen?</h3><p>Let AI turn your available ingredients into a meal idea.</p></div><button className="primary-btn" onClick={generateRecipes}><Sparkles size={16}/> Find recipes</button></div>
  </section>
}
function StatCard({icon:Icon,label,value,note,tint,onClick}) { return <button className="stat-card" onClick={onClick}><div className={`stat-icon ${tint}`}><Icon size={19}/></div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span></button> }
function GroceryRow({item,toggle,remove}) { return <div className={`grocery-row ${item.checked?'is-checked':''}`}><button className={`checkbox ${item.checked?'checked':''}`} onClick={()=>toggle(item.id)} aria-label={item.checked?'Uncheck item':'Mark purchased'}>{item.checked&&<Check size={14}/>}</button><div className="grocery-item-copy"><strong>{item.name}</strong><span>{item.qty} {item.unit} <i>·</i> {item.category}</span></div><div className="row-actions">{item.checked&&<span className="purchased-label">Purchased</span>}<button className="icon-button delete-btn" onClick={()=>remove(item.id)} aria-label="Delete grocery"><Trash2 size={16}/></button></div></div> }
function InventoryCard({item,remove}) { const s=expiryStatus(item.expiry); return <div className="inventory-card"><div className="inventory-card-top"><div className="ingredient-icon"><Leaf size={19}/></div><button className="icon-button delete-btn" onClick={()=>remove(item.id)} aria-label="Delete ingredient"><Trash2 size={16}/></button></div><span className="category-label">{item.category}</span><h3>{item.name}</h3><p className="quantity-line">{item.qty} {item.unit}</p><div className="inventory-card-bottom"><span className={`status-badge ${s.cls}`}><span/> {s.label}</span><span className="expiry-date">{fmtDate(item.expiry)}</span></div></div> }
function RecipeCard({recipe}) { return <article className="recipe-card"><div className="recipe-card-art"><div className="recipe-art-icon"><CookingPot size={35}/></div><span className="recipe-tag"><Sparkles size={12}/> AI suggestion</span></div><div className="recipe-card-content"><h3>{recipe.title}</h3><p>{recipe.description}</p><div className="recipe-meta"><span><Clock3 size={14}/>{recipe.total_minutes || ((recipe.prep_minutes||0)+(recipe.cook_minutes||0)) || '—'} min</span><span><PackageCheck size={14}/>{recipe.ingredients?.length || 0} ingredients</span></div><details className="recipe-details"><summary>View cooking steps <ArrowRight size={14}/></summary><div className="recipe-ingredient-list"><strong>Ingredients</strong>{(recipe.ingredients||[]).map((i,n)=><div key={n}>• {i.name} — {i.quantity} {i.unit}</div>)}<strong>Instructions</strong><ol>{(recipe.instructions||[]).map((s,n)=><li key={n}>{s}</li>)}</ol></div></details></div></article> }
function EmptyState({title,text}) { return <div className="empty-state"><div className="empty-icon"><Leaf size={22}/></div><strong>{title}</strong><p>{text}</p></div> }