import { useState, useEffect } from 'react';
import { Activity, Server, AlertTriangle, CheckCircle, Clock, ChefHat, PackageCheck, Zap } from 'lucide-react';
import LoginForm from './components/LoginForm'; // Importing the secure login component



function App() {
  const [gatewayHealth, setGatewayHealth] = useState('Checking...');
  const [metrics, setMetrics] = useState({ total_orders: 0, failure_count: 0, avg_latency_ms: 0 });
  const [studentId, setStudentId] = useState('');
  const [token, setToken] = useState(null);
  const [orderStatus, setOrderStatus] = useState('None');
  
  // New state for the live stock tracker
  const [remainingStock, setRemainingStock] = useState('...'); 

  // Polling for Health, Metrics, and Live Stock every 3 seconds
  useEffect(() => {
    const fetchHealthAndStats = async () => {
      try {
        // 1. Fetch Gateway Health
        const res = await fetch('http://localhost:3000/health');
        if (res.ok) setGatewayHealth('ONLINE');
        else setGatewayHealth('OFFLINE');
        
        // 2. Fetch Metrics
        const metricsRes = await fetch('http://localhost:3000/metrics');
        setMetrics(await metricsRes.json());

        // 3. Fetch Real-time Stock
        const stockRes = await fetch('http://localhost:3000/stock/iftar_box_1');
        const stockData = await stockRes.json();
        if (stockData.stock !== undefined) setRemainingStock(stockData.stock);

      } catch (e) {
        setGatewayHealth('OFFLINE');
      }
    };
    const interval = setInterval(fetchHealthAndStats, 3000);
    return () => clearInterval(interval);
  }, []);

  // Listen for Server-Sent Events (SSE) from the Notification Hub
  useEffect(() => {
    const eventSource = new EventSource('http://localhost:3004/stream');
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status === 'Ready') setOrderStatus('Ready');
    };
    return () => eventSource.close();
  }, []);

  const placeOrder = async () => {
    setOrderStatus('Pending');
    try {
      const response = await fetch('http://localhost:3000/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ itemId: 'iftar_box_1' })
      });
      
      if (response.status === 202) {
        // Gateway accepted it, stock is verified!
        setTimeout(() => setOrderStatus('Stock Verified'), 500);
        // Simulate RabbitMQ picking it up slightly after
        setTimeout(() => setOrderStatus('In Kitchen'), 1500);
      } else {
        const data = await response.json();
        setOrderStatus('None');
        alert(`Order failed: ${data.error}`);
      }
    } catch (e) { 
      setOrderStatus('None'); 
      alert('Gateway is offline!');
    }
  };

  const triggerLag = async () => await fetch('http://localhost:3000/simulate-lag', { method: 'POST' });
  const triggerChaos = async () => await fetch('http://localhost:3000/chaos', { method: 'POST' });

  // Helper for progress bar styling
  const getStepStatus = (stepName) => {
    const stages = ['None', 'Pending', 'Stock Verified', 'In Kitchen', 'Ready'];
    const currentIndex = stages.indexOf(orderStatus);
    const stepIndex = stages.indexOf(stepName);
    if (currentIndex >= stepIndex) return 'text-green-600 font-bold';
    if (currentIndex === stepIndex - 1 && orderStatus !== 'None') return 'text-blue-500 animate-pulse font-semibold';
    return 'text-gray-400';
  };

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto text-gray-800">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">IUT Cafeteria OS</h1>
          <p className="text-gray-500 mt-1">DevSprint 2026 Microservice Architecture</p>
        </div>
        <div className="px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-sm uppercase tracking-wider">System Live</span>
        </div>
      </div>

      {/* Visual Alert Banner (Triggers if Latency > 1000ms) */}
      {metrics.avg_latency_ms > 1000 && (
        <div className="mb-6 p-4 bg-red-600 text-white rounded-lg shadow-lg flex items-center justify-center gap-3 animate-pulse">
          <AlertTriangle className="w-6 h-6" />
          <span className="font-bold text-lg">CRITICAL ALERT: Gateway Latency Degraded ({metrics.avg_latency_ms}ms)</span>
        </div>
      )}

      {/* --- LIVE INVENTORY CARD --- */}
      <div className="mb-8 bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden col-span-1 lg:col-span-2">
        <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-800">Live Cafeteria Inventory</h2>
          </div>
          {/* A pulsing live dot to show it's updating in real-time */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
            </span>
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Live Sync</span>
          </div>
        </div>

        <div className="p-6 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-extrabold text-gray-900">Standard Iftar Box</h3>
            <p className="text-gray-500">Item ID: iftar_box_1</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Remaining Stock</p>
            {/* Changes color to red if stock drops below 50 */}
            <p className={`text-5xl font-black transition-colors duration-500 ${remainingStock < 50 ? 'text-red-500' : 'text-indigo-600'}`}>
              {remainingStock}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* --- ADMIN DASHBOARD CARD --- */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 p-4 border-b border-gray-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-bold text-gray-800">Admin Monitoring</h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-500 font-medium mb-1">Gateway Health</p>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${gatewayHealth === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="font-bold text-lg">{gatewayHealth}</span>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-500 font-medium mb-1">30s Avg Latency</p>
                <p className="font-bold text-2xl text-blue-600">{metrics.avg_latency_ms} <span className="text-sm text-gray-500">ms</span></p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-500 font-medium mb-1">Total Orders</p>
                <p className="font-bold text-2xl text-gray-800">{metrics.total_orders}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-500 font-medium mb-1">Failures</p>
                <p className="font-bold text-2xl text-red-500">{metrics.failure_count}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={triggerLag} className="flex-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
                <Clock className="w-4 h-4" /> Simulate Lag
              </button>
              <button onClick={triggerChaos} className="flex-1 bg-red-100 hover:bg-red-200 text-red-800 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors">
                <Zap className="w-4 h-4" /> Kill Gateway
              </button>
            </div>
          </div>
        </div>

        {/* --- STUDENT JOURNEY CARD --- */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="bg-blue-50 p-4 border-b border-blue-100 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-800">Student Journey</h2>
          </div>

          <div className="p-6 bg-gray-50 h-full">
            {!token ? (
              <LoginForm 
                onLoginSuccess={(newToken, newStudentId) => {
                  setToken(newToken);
                  setStudentId(newStudentId);
                }} 
              />
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-gray-600">Logged in as: <span className="font-bold text-gray-900">{studentId}</span></p>
                  <button 
                    onClick={placeOrder} 
                    disabled={orderStatus !== 'None' && orderStatus !== 'Ready' && remainingStock > 0}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                  >
                    <PackageCheck className="w-5 h-5" /> 
                    {remainingStock <= 0 ? 'Out of Stock' : 'Place Iftar Order'}
                  </button>
                </div>

                {/* Live Tracker */}
                {orderStatus !== 'None' && (
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">Live Order Status</h3>
                    
                    <div className="flex justify-between items-center relative">
                      {/* Progress Line */}
                      <div className="absolute left-0 top-4 w-full h-1 bg-gray-200 -z-10 rounded-full"></div>
                      
                      <div className={`flex flex-col items-center gap-2 bg-gray-50 px-2 ${getStepStatus('Pending')}`}>
                        <Clock className="w-8 h-8 bg-gray-50" />
                        <span className="text-xs">Pending</span>
                      </div>
                      
                      <div className={`flex flex-col items-center gap-2 bg-gray-50 px-2 ${getStepStatus('Stock Verified')}`}>
                        <CheckCircle className="w-8 h-8 bg-gray-50" />
                        <span className="text-xs text-center">Stock<br/>Verified</span>
                      </div>

                      <div className={`flex flex-col items-center gap-2 bg-gray-50 px-2 ${getStepStatus('In Kitchen')}`}>
                        <ChefHat className="w-8 h-8 bg-gray-50" />
                        <span className="text-xs text-center">In<br/>Kitchen</span>
                      </div>

                      <div className={`flex flex-col items-center gap-2 bg-gray-50 px-2 ${getStepStatus('Ready')}`}>
                        <PackageCheck className="w-8 h-8 bg-gray-50" />
                        <span className="text-xs">Ready</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;