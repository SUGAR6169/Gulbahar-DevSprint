import { useState, useEffect } from 'react';

function App() {
  const [gatewayHealth, setGatewayHealth] = useState('Checking...');
  const [metrics, setMetrics] = useState({ total_orders: 0, failure_count: 0, avg_latency_ms: 0 });
  const [studentId, setStudentId] = useState('');
  const [token, setToken] = useState(null);
  const [orderStatus, setOrderStatus] = useState('None');

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('http://localhost:3000/health');
        if (res.ok) setGatewayHealth('🟢 ONLINE');
        else setGatewayHealth('🔴 OFFLINE');
        
        const metricsRes = await fetch('http://localhost:3000/metrics');
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      } catch (e) {
        setGatewayHealth('🔴 OFFLINE');
      }
    };
    const interval = setInterval(fetchHealth, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const eventSource = new EventSource('http://localhost:3004/stream');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status === 'Ready') setOrderStatus('Ready');
    };
    return () => eventSource.close();
  }, []);

  const handleLogin = async () => {
    try {
      const response = await fetch('http://localhost:3001/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, password: 'password123' })
      });
      const data = await response.json();
      if (data.token) {
        setToken(data.token);
        alert('Login Successful!');
      }
    } catch (e) { alert('Could not connect'); }
  };

  const placeOrder = async () => {
    setOrderStatus('Pending');
    try {
      const response = await fetch('http://localhost:3000/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ itemId: 'iftar_box_1' })
      });
      if (response.status === 202) setTimeout(() => setOrderStatus('In Kitchen'), 1000);
      else setOrderStatus('None');
    } catch (e) { setOrderStatus('None'); }
  };

  // Triggers the fake lag so the judges can see the visual alert!
  const triggerLag = async () => {
    await fetch('http://localhost:3000/simulate-lag', { method: 'POST' });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center' }}>IUT Cafeteria System</h1>
      
      {/* THE VISUAL ALERT BANNER */}
      {metrics.avg_latency_ms > 1000 && (
        <div style={{ background: 'red', color: 'white', padding: '15px', textAlign: 'center', fontWeight: 'bold', fontSize: '20px', marginBottom: '20px', borderRadius: '8px', animation: 'pulse 2s infinite' }}>
          🚨 CRITICAL ALERT: SYSTEM DEGRADED! Average Latency exceeded 1 second! ({metrics.avg_latency_ms} ms) 🚨
        </div>
      )}

      <div style={{ padding: '15px', border: '2px solid #333', marginBottom: '30px', borderRadius: '8px' }}>
        <h2>⚙️ Admin Dashboard</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <p><strong>Gateway Status:</strong> {gatewayHealth}</p>
            <p><strong>Total Orders:</strong> {metrics.total_orders}</p>
          </div>
          <div>
            <p><strong>Failures:</strong> {metrics.failure_count}</p>
            <p><strong>30s Avg Latency:</strong> {metrics.avg_latency_ms} ms</p>
          </div>
        </div>
        <button onClick={triggerLag} style={{ background: '#ffc107', padding: '10px 15px', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '10px', marginRight: '10px' }}>
          🐌 Simulate Server Lag (Trigger Alert)
        </button>
      </div>

      <div style={{ padding: '15px', border: '2px solid #007bff', borderRadius: '8px' }}>
        <h2>🎓 Student Journey</h2>
        {!token ? (
          <div>
            <input type="text" placeholder="Enter Student ID" value={studentId} onChange={(e) => setStudentId(e.target.value)} style={{ padding: '8px', marginRight: '10px' }} />
            <button onClick={handleLogin} style={{ padding: '8px 15px', background: '#28a745', color: 'white', border: 'none' }}>Login</button>
          </div>
        ) : (
          <div>
            <button onClick={placeOrder} disabled={orderStatus !== 'None' && orderStatus !== 'Ready'} style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', fontSize: '16px' }}>
              🛒 Place Iftar Order
            </button>
            {orderStatus !== 'None' && (
              <p style={{ marginTop: '20px', fontSize: '18px', fontWeight: 'bold' }}>Status: {orderStatus}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;