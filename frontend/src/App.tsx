import React, { useState, useEffect } from 'react';
import './App.css';
import { apiService, Item, ItemCreate } from './services/apiService';

const App: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<ItemCreate>({
    name: '',
    description: ''
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const fetchedItems = await apiService.getItems();
      setItems(fetchedItems);
      setError(null);
    } catch (err) {
      setError('Failed to fetch items');
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim() || !newItem.description.trim()) {
      setError('Please fill in all fields');
      return;
    }

    try {
      const createdItem = await apiService.createItem(newItem);
      setItems([...items, createdItem]);
      setNewItem({ name: '', description: '' });
      setError(null);
    } catch (err) {
      setError('Failed to create item');
      console.error('Error creating item:', err);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    try {
      await apiService.deleteItem(itemId);
      setItems(items.filter(item => item.id !== itemId));
      setError(null);
    } catch (err) {
      setError('Failed to delete item');
      console.error('Error deleting item:', err);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Superb Game</h1>
        <p>Full Stack Application with React + TypeScript & Python FastAPI</p>
      </header>

      <main className="main-content">
        {error && <div className="error-message">{error}</div>}

        <section className="create-item-section">
          <h2>Add New Item</h2>
          <form onSubmit={handleCreateItem} className="create-item-form">
            <div className="form-group">
              <label htmlFor="name">Name:</label>
              <input
                type="text"
                id="name"
                value={newItem.name}
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                placeholder="Enter item name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">Description:</label>
              <textarea
                id="description"
                value={newItem.description}
                onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                placeholder="Enter item description"
                rows={3}
              />
            </div>
            <button type="submit" className="submit-btn">Add Item</button>
          </form>
        </section>

        <section className="items-section">
          <h2>Items ({items.length})</h2>
          {items.length === 0 ? (
            <p className="no-items">No items found. Create your first item above!</p>
          ) : (
            <div className="items-grid">
              {items.map((item) => (
                <div key={item.id} className="item-card">
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <div className="item-actions">
                    <span className="item-id">ID: {item.id}</span>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="delete-btn"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;
