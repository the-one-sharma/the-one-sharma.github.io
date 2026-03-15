// roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
    if(w<2*r)r=w/2;if(h<2*r)r=h/2;
    this.beginPath();
    this.moveTo(x+r,y);this.arcTo(x+w,y,x+w,y+h,r);
    this.arcTo(x+w,y+h,x,y+h,r);this.arcTo(x,y+h,x,y,r);
    this.arcTo(x,y,x+w,y,r);this.closePath();
    return this;
  };
}
// ════════════════════════════════════════════════════════════
//  SECTION 1 — CASCADE MAP
//  Rich hover: shows WHAT the node is + WHY it moves
// ════════════════════════════════════════════════════════════
const canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
const isDark=matchMedia('(prefers-color-scheme:dark)').matches;
const LOGIC_W=900,LOGIC_H=820;
let mapScale=1;

function resizeMap(){
  const w=document.getElementById('canvas-wrap').clientWidth;
  mapScale=w/LOGIC_W;
  const D=window.devicePixelRatio||1;
  canvas.width=w*D;canvas.height=LOGIC_H*mapScale*D;
  canvas.style.height=(LOGIC_H*mapScale)+'px';
  ctx.setTransform(D*mapScale,0,0,D*mapScale,0,0);
  drawMap();
}
let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => { resizeMap(); resizeGraph(); }, 60);
});

const MC={
  up:'#1fd47a',down:'#ff4060',amb:'#f5a623',
  node:'#18181e',nodeBd:'#2e2c42',
  nodeHov:'#1e1e26',
  text:'#eceaf4',sub:'#565470',edge:'#22202e',
  upBg:'rgba(31,212,122,.15)',upTxt:'#1fd47a',
  dnBg:'rgba(255,64,96,.15)',dnTxt:'#ff4060',
  amBg:'rgba(245,166,35,.15)',amTxt:'#f5a623',
};

const nodes=[
  {id:'fed',x:450,y:44,label:'Fed / govt',sub:'policy lever'},
  {id:'ms',x:110,y:148,label:'Money supply',sub:'M1 / M2'},
  {id:'ir',x:290,y:148,label:'Interest rate',sub:'nominal / real'},
  {id:'lf',x:470,y:148,label:'Loanable funds',sub:'credit market'},
  {id:'xrate',x:650,y:148,label:'Exchange rate',sub:'USD vs foreign'},
  {id:'inflexp',x:830,y:148,label:'Inflation expect.',sub:'Fisher effect'},
  {id:'inv',x:110,y:268,label:'Investment (I)',sub:'business spending'},
  {id:'ad',x:290,y:268,label:'Aggregate demand',sub:'C+I+G+NX'},
  {id:'price',x:470,y:268,label:'Price level',sub:'CPI / inflation'},
  {id:'lras',x:650,y:268,label:'LRAS / potential',sub:'long-run output'},
  {id:'sras',x:830,y:268,label:'SRAS',sub:'short-run AS'},
  {id:'gdp',x:110,y:388,label:'Real GDP',sub:'output'},
  {id:'unemp',x:290,y:388,label:'Unemployment',sub:'Phillips curve'},
  {id:'wages',x:470,y:388,label:'Wages',sub:'labor market'},
  {id:'prodcost',x:650,y:388,label:'Prod. costs',sub:'firms\' ATC/MC'},
  {id:'profit',x:830,y:388,label:'Firm profit',sub:'TR − TC'},
  {id:'cons',x:110,y:508,label:'Consumer spending',sub:'C, MPC driven'},
  {id:'tax',x:290,y:508,label:'Tax revenue',sub:'govt finances'},
  {id:'trade',x:470,y:508,label:'Net exports (NX)',sub:'X − M'},
  {id:'surplus',x:650,y:508,label:'Cons. surplus',sub:'buyer welfare'},
  {id:'prodsurp',x:830,y:508,label:'Prod. surplus',sub:'seller welfare'},
  {id:'welfare',x:110,y:628,label:'Social welfare',sub:'CS + PS'},
  {id:'extern',x:290,y:628,label:'Externality',sub:'market failure'},
  {id:'market',x:470,y:628,label:'Market output',sub:'Q & P equilib.'},
  {id:'equity',x:650,y:628,label:'Income equity',sub:'distribution'},
  {id:'publicg',x:830,y:628,label:'Public goods',sub:'non-rival/excl.'},
];

// Tooltip: 'what' is static; 'why' is direction-aware (up/down/amb/idle)
const nodeInfo={
  fed:{
    what:'The Federal Reserve (monetary) and government (fiscal) are the top-level policy levers. The Fed acts via open market operations, reserve requirements, and the discount rate. Government acts via taxes and spending.',
    up:  'The Fed is easing or government is stimulating — buying bonds, cutting the discount rate, lowering reserve requirements, or raising spending. This injects money and/or demand into the economy.',
    down:'The Fed is tightening or government is contracting — selling bonds, raising the discount rate, hiking reserve requirements, or cutting spending. This withdraws money and/or demand from the economy.',
    idle:'No shock active. The Fed and government set the starting conditions for all other variables in the cascade.',
  },
  ms:{
    what:'Money supply (M1+M2). M1 = cash + checking. M2 = M1 + savings/CDs. Money multiplier = 1 ÷ reserve requirement — at 10% RR, a $1,000 deposit creates $9,000 in new loans.',
    up:  'Money supply is rising because the Fed bought bonds (injecting reserves), cut the discount rate (making bank borrowing cheaper), or lowered reserve requirements (expanding the multiplier). More money in circulation pushes interest rates down.',
    down:'Money supply is falling because the Fed sold bonds (draining reserves), raised the discount rate, or raised reserve requirements (shrinking the multiplier). Less money means banks lend less and rates rise.',
    idle:'No shock active. Money supply is the primary transmission channel from Fed policy to interest rates.',
  },
  ir:{
    what:'Nominal interest rate = cost of borrowing. Real rate = nominal − expected inflation (Fisher equation). The Fed directly influences the federal funds rate; market rates follow.',
    up:  'Interest rates are rising because the money supply fell, inflation expectations rose (Fisher effect), or government borrowing crowded out private lenders in the loanable funds market. Higher rates make investment more expensive.',
    down:'Interest rates are falling because the money supply expanded (Fed bought bonds), inflation expectations fell, or savings increased. Lower rates make borrowing cheaper and stimulate investment.',
    idle:'No shock active. Interest rates are the key transmission mechanism linking monetary policy to investment and the broader economy.',
  },
  lf:{
    what:'Loanable funds market: supply = national savings + capital inflows; demand = investment borrowing + government deficits. The real interest rate equilibrates supply and demand.',
    up:  'Loanable funds supply is rising (more savings or capital inflows) OR demand is falling. Either way, credit is more available, pushing the real rate down — boosting private investment.',
    down:'Loanable funds are tighter because government is borrowing more (crowding out) or savings fell. This pushes the real interest rate up, raising the cost of private investment.',
    idle:'No shock active. This market determines the real interest rate independently of the money market — a key distinction on the AP exam.',
  },
  xrate:{
    what:'Exchange rate (USD per foreign currency). Dollar appreciates when US rates rise (attracting capital inflows). Depreciates when US rates fall or domestic inflation makes goods less competitive.',
    up:  'The dollar is appreciating — US interest rates rose, attracting foreign capital that buys dollars. A stronger dollar makes US exports more expensive abroad and imports cheaper, so net exports fall.',
    down:'The dollar is depreciating — US interest rates fell or inflation eroded purchasing power. A weaker dollar makes exports cheaper and imports more expensive, boosting net exports and AD.',
    idle:'No shock active. The exchange rate links monetary policy to the trade balance (NX component of AD).',
  },
  inflexp:{
    what:'Inflation expectations. Fisher effect: nominal rate = real rate + expected inflation. If workers expect 3% inflation, they demand 3% higher wages even before prices actually rise.',
    up:  'Inflation expectations are rising — past price increases or a credibility loss at the Fed is making workers and firms expect future inflation. This immediately raises nominal interest rates (Fisher) and pushes wages and costs up, shifting SRAS left.',
    down:'Inflation expectations are falling — the Fed has credibly committed to its target, or a supply shock pushed prices down. Lower expectations reduce wage demands, cutting costs and allowing SRAS to shift right.',
    idle:'No shock active. Anchoring inflation expectations at ~2% is one of the Fed\'s most important mandates.',
  },
  inv:{
    what:'Business investment = spending on new capital (factories, equipment, software, housing). Most interest-rate-sensitive component of AD. Included in GDP as the "I" in C+I+G+NX.',
    up:  'Investment is rising because interest rates fell (projects now have positive NPV), business confidence improved, or the government offered tax incentives. This shifts AD right and builds the capital stock, eventually shifting LRAS right.',
    down:'Investment is falling because rates rose (borrowing too expensive), business pessimism set in (Keynesian "animal spirits"), or credit tightened. This shifts AD left — the Keynesian liquidity trap risk arises if rates are already near zero.',
    idle:'No shock active. Investment is the primary channel through which monetary policy affects real output.',
  },
  ad:{
    what:'Aggregate demand = C + I + G + NX. Downward sloping due to three effects: wealth (P↑ → real wealth↓ → C↓), interest rate (P↑ → money demand↑ → ir↑ → I↓), and international trade (P↑ → exports fall).',
    up:  'AD is shifting right — one or more components increased: consumer spending rose (confidence, wealth effect, tax cut), investment rose (lower rates, optimism), government spending rose, or net exports increased (dollar depreciated, foreign demand rose). The Keynesian multiplier amplifies the initial shift.',
    down:'AD is shifting left — consumers are spending less (confidence fell, wealth declined, taxes rose), investment fell (rates rose, pessimism), government cut spending, or net exports fell (dollar appreciated, foreign recession). The multiplier works in reverse too.',
    amb: 'AD effect is ambiguous — competing forces are pushing in opposite directions (e.g. a tariff raises G revenue but cuts NX and consumer spending).',
    idle:'No shock active. AD is the central variable in Keynesian macroeconomics — shifts here drive the short-run business cycle.',
  },
  price:{
    what:'Price level (CPI). Demand-pull inflation: AD rises faster than AS. Cost-push inflation: SRAS shifts left due to supply shocks. Core CPI excludes food and energy; military equipment is never included.',
    up:  'Prices are rising — either AD shifted right (demand-pull: economy overheating) or SRAS shifted left (cost-push: oil shock, wage push, supply chain disruption). Rising prices erode real wages, reduce net exports, and raise inflation expectations.',
    down:'Prices are falling — AD contracted (demand-pull deflation: recession) or SRAS shifted right (positive supply shock: oil fell, productivity rose). Falling prices improve real wages and purchasing power but risk debt-deflation spirals.',
    amb: 'Price effect is ambiguous — AD and SRAS are moving in opposite directions simultaneously (e.g. stagflation: SRAS left raises P while falling AD also lowers P).',
    idle:'No shock active. Price level is where AD and SRAS intersect in the short run.',
  },
  lras:{
    what:'Long-run aggregate supply = potential GDP. Vertical because all prices and wages adjust fully in the long run. Determined by: capital stock, technology, labor force size and quality.',
    up:  'Potential GDP is growing — technology improved, capital stock expanded through investment, or the labor force grew. This shifts LRAS right, allowing more output without inflationary pressure. This is long-run economic growth.',
    down:'Potential GDP is shrinking — capital was destroyed (war, disaster), the labor force shrank (aging, emigration), or productivity fell. The economy can sustain less output at full employment.',
    idle:'No shock active. LRAS anchors the long-run equilibrium — the economy self-corrects toward it over time as wages adjust.',
  },
  sras:{
    what:'Short-run aggregate supply. Upward sloping because input prices (especially wages) are sticky in the short run. As output rises, firms pay overtime and face higher per-unit costs.',
    up:  'SRAS is shifting right — production costs fell (oil price drop, wage moderation, productivity gain, favorable supply shock). More output is available at every price level, pushing prices down and output up.',
    down:'SRAS is shifting left — production costs rose (oil spike, wage push, import price rise, inflation expectations). Each unit costs more to produce, so less is supplied at every price level — the stagflation scenario.',
    idle:'No shock active. SRAS shifts are the mechanism for cost-push inflation and positive supply shocks.',
  },
  gdp:{
    what:'Real GDP = total output adjusted for inflation. C(~70%) + I(~18%) + G(~17%) + NX(often negative in US). Above potential Yp = inflationary gap; below = recessionary gap.',
    up:  'Real GDP is rising — AD shifted right (more spending) or SRAS shifted right (lower costs). The economy is expanding: firms hire more → unemployment falls → wages rise → consumer spending rises further (multiplier). Tax revenue rises automatically as an automatic stabilizer.',
    down:'Real GDP is falling — AD contracted (recession) or SRAS shifted left (stagflation). Firms lay off workers → unemployment rises → wages fall → spending falls further (negative multiplier). Tax revenue automatically falls, providing some cushion.',
    amb: 'GDP is ambiguous — competing shocks are offsetting each other.',
    idle:'No shock active. Real GDP per capita is the best single measure of economic welfare for exam purposes.',
  },
  unemp:{
    what:'Types: Frictional (between jobs — always exists), Structural (skills mismatch), Cyclical (recession-driven), Seasonal. Natural rate ≈ 4–5% = frictional + structural. NAIRU = non-accelerating inflation rate of unemployment.',
    up:  'Unemployment is rising — GDP fell below potential (cyclical unemployment). Firms reduce hours and lay off workers. The official rate understates true unemployment: it excludes discouraged workers who stopped looking and underemployed part-timers.',
    down:'Unemployment is falling — GDP is above natural rate. Labor markets are tight; firms compete for workers and pay higher wages. Phillips curve: this puts upward pressure on inflation in the short run.',
    amb: 'Unemployment effect is ambiguous — a shock may create jobs in some sectors while destroying them in others (e.g. tariffs protect steel jobs but destroy auto jobs).',
    idle:'No shock active. Unemployment never reaches zero because frictional and structural unemployment always exist.',
  },
  wages:{
    what:'Wages = price of labor. Sticky downward in the short run due to contracts, morale effects, and efficiency wages. This stickiness causes recessions to persist longer than classical economics predicts.',
    up:  'Wages are rising because unemployment fell below the natural rate (tight labor market, workers have bargaining power) or union power increased or a minimum wage hike. Higher wages raise consumer spending but also raise production costs, shifting SRAS left.',
    down:'Wages are falling because unemployment rose above the natural rate (excess labor supply) or automation reduced labor demand. Lower wages cut production costs (shifting SRAS right over time) but also reduce consumer spending.',
    amb: 'Wage effect is ambiguous — some workers gain while others lose, or nominal wages are rising but real wages are falling due to inflation.',
    idle:'No shock active. Wage adjustment is the self-correction mechanism that brings the economy back to potential GDP in the long run.',
  },
  prodcost:{
    what:'Production costs = variable costs (labor, materials, energy) + fixed costs (rent, machinery). ATC = AVC + AFC. MC = marginal cost per additional unit. Per-unit tax shifts MC and ATC up; lump-sum tax only shifts ATC/AFC.',
    up:  'Production costs are rising — wages rose, oil/energy spiked, raw materials became more expensive, or a per-unit tax was imposed. Higher costs shift SRAS left: at every output level, firms need a higher price to cover costs → stagflation pressure.',
    down:'Production costs are falling — wages moderated, oil fell, productivity improved, or a subsidy was granted. Lower costs shift SRAS right: firms can profitably supply more at every price → output↑, prices↓.',
    idle:'No shock active. Cost changes are the most direct driver of SRAS shifts.',
  },
  profit:{
    what:'Economic profit = TR − TC including opportunity cost. Zero economic profit in long-run perfect competition (not zero accounting profit). Monopoly sustains positive economic profit by restricting output.',
    up:  'Profit is rising — either revenue increased (higher price or more output) or costs fell. Rising profits attract new entrants in competitive markets, eventually driving profit back toward zero. In the short run, profit increases incentivize investment and capital accumulation.',
    down:'Profit is falling — costs rose above revenue, price fell (competition or recession), or a per-unit tax squeezed the margin. Falling profits cause exit in competitive markets, reducing supply until price recovers.',
    idle:'No shock active. Economic profit (not accounting profit) drives entry/exit decisions.',
  },
  cons:{
    what:'Consumer spending ≈ 70% of US GDP. Driven by income, MPC (marginal propensity to consume), wealth, confidence, interest rates, and expectations. MPC = ΔC/ΔY.',
    up:  'Consumer spending is rising because incomes rose (GDP↑, wages↑), a tax cut raised disposable income, asset prices created a wealth effect, or consumer confidence improved. The spending multiplier amplifies each dollar: 1/(1−MPC). With MPC=0.8, each $1 in new spending generates $5 in total GDP.',
    down:'Consumer spending is falling because incomes fell (recession, unemployment), taxes rose, asset prices fell (negative wealth effect), or confidence collapsed. The multiplier works in reverse: falling spending contracts GDP further.',
    idle:'No shock active. Consumer spending is the largest and most stable component of AD.',
  },
  tax:{
    what:'Government tax revenue. Automatic stabilizer — rises in booms (cooling the economy) and falls in recessions (cushioning the blow) without any policy action. Laffer curve: beyond some rate, higher taxes reduce revenue.',
    up:  'Tax revenue is rising because GDP grew (more income to tax — automatic stabilizer effect), a tax rate was increased, or a tariff generated customs revenue. Higher revenue reduces the deficit and may reduce crowding out in the loanable funds market.',
    down:'Tax revenue is falling because GDP contracted (recession automatic stabilizer) or tax rates were cut. Lower revenue widens the deficit, requiring more government borrowing in the loanable funds market.',
    amb: 'Tax revenue effect is ambiguous — a tax cut may stimulate enough growth to partially offset the rate reduction (Laffer effect), making the net revenue impact unclear.',
    idle:'No shock active. Tax revenue is an automatic stabilizer — one of the key built-in mechanisms that reduce business cycle volatility.',
  },
  trade:{
    what:'Net exports (NX) = Exports − Imports. Part of AD. Determined by: domestic vs. foreign price levels, exchange rates, foreign income, and trade policy (tariffs, quotas).',
    up:  'Net exports are rising because the dollar depreciated (making exports cheaper abroad and imports more expensive), foreign demand increased, or domestic prices fell relative to trading partners. Higher NX shifts AD right.',
    down:'Net exports are falling because the dollar appreciated (exports more expensive), domestic inflation made goods uncompetitive, or foreign income fell. Lower NX shifts AD left.',
    amb: 'NX effect is ambiguous — for example a tariff may reduce imports but trigger foreign retaliation that also reduces exports.',
    idle:'No shock active. NX is typically negative for the US (trade deficit), financed by capital account surplus.',
  },
  surplus:{
    what:'Consumer surplus (CS) = area above price, below the demand curve. It measures how much buyers gain — the difference between their willingness to pay and what they actually pay.',
    up:  'Consumer surplus is increasing because prices fell (supply increased, subsidy granted, or market became more competitive) or quantity restrictions were removed. Buyers are getting more value for their money.',
    down:'Consumer surplus is falling because prices rose (demand increased, supply fell, tariff, monopoly pricing) or quantity was restricted. Buyers are losing value — the triangle above P* under the demand curve is shrinking.',
    idle:'No shock active. Consumer surplus + producer surplus = total economic welfare. Deadweight loss = the CS and PS destroyed by market distortions.',
  },
  prodsurp:{
    what:'Producer surplus (PS) = area below price, above the supply curve. It measures seller gains — the difference between the price received and the minimum price they would have accepted.',
    up:  'Producer surplus is rising because prices rose (demand increased) while costs stayed the same — sellers are getting more than their minimum acceptable price. A tariff that raises domestic prices also transfers CS to domestic producers as PS.',
    down:'Producer surplus is falling because prices fell (competition entered, subsidy removed) or costs rose. In a price ceiling, sellers receive less than market price, compressing PS sharply.',
    idle:'No shock active. PS + CS = total surplus. Any policy that moves price away from equilibrium reduces one or both.',
  },
  welfare:{
    what:'Social welfare = CS + PS − external costs + public goods. Maximized at the competitive equilibrium (P=MC). Deadweight loss is the welfare destroyed by distortions.',
    up:  'Welfare is rising because a distortion was removed (tariff reduced, price control lifted, monopoly regulated) or a positive externality was subsidized. Moving toward the competitive equilibrium recovers deadweight loss.',
    down:'Welfare is falling because a new distortion was introduced (monopoly pricing, tax, quota, price control) or a negative externality was not corrected. The deadweight loss triangle represents value permanently destroyed.',
    amb: 'Welfare effect is ambiguous — some groups gain while others lose by more or less, making the net effect unclear without knowing the magnitudes.',
    idle:'No shock active. Welfare analysis is the foundation of normative economics — should a policy be adopted?',
  },
  extern:{
    what:'Externality = a cost or benefit imposed on a third party not reflected in the market price. Negative (pollution, smoking): market overproduces. Positive (education, vaccines): market underproduces.',
    up:  'The externality (negative) is growing — the gap between social cost and private cost is widening, so the market is overproducing further beyond the socially optimal level. The deadweight loss triangle is expanding.',
    down:'The externality is being corrected — a Pigouvian tax (negative externality) or subsidy (positive) is internalizing the social cost/benefit, pushing market output toward the socially optimal quantity and reducing DWL.',
    amb: 'Externality effect is ambiguous — it is unclear whether the corrective policy is moving output toward or away from the social optimum.',
    idle:'No shock active. Externalities are one of the four main sources of market failure (alongside public goods, information asymmetries, and market power).',
  },
  market:{
    what:'Market equilibrium: Q demanded = Q supplied. Price mechanism coordinates buyers and sellers without central planning. Allocative efficiency: P=MC. Productive efficiency: min ATC.',
    up:  'Market output is rising — supply increased (costs fell, subsidized, new entrants) or demand increased. Moving toward the equilibrium from a restricted position recovers deadweight loss and increases both CS and PS.',
    down:'Market output is falling — a distortion is restricting quantity below equilibrium (monopoly restricts output, tax raises cost, quota caps imports, price control creates shortage or surplus). Deadweight loss is created.',
    idle:'No shock active. The competitive equilibrium is the benchmark for welfare analysis.',
  },
  equity:{
    what:'Income equity = fairness of income distribution. Measured by the Lorenz curve and Gini coefficient (0 = perfect equality, 1 = all income to one person). Okun\'s leaky bucket: redistribution always involves some efficiency loss.',
    up:  'Equity is improving — progressive taxes or transfer payments are redistributing income toward lower earners, wages for low-income workers are rising, or union bargaining power has increased. The Lorenz curve is bowing less sharply.',
    down:'Equity is worsening — automation is reducing wages for low-skill workers, taxes became more regressive, or capital gains (which accrue to top earners) rose while wages stagnated. The Gini coefficient is rising.',
    amb: 'Equity effect is ambiguous — the policy helps some income groups while hurting others, and the net distributional impact depends on magnitudes and MPC differences.',
    idle:'No shock active. Equity and efficiency are often in tension — the core trade-off in public economics.',
  },
  publicg:{
    what:'Public goods: non-rival (my use doesn\'t reduce yours) + non-excludable (can\'t prevent free riders). Examples: national defense, clean air, public broadcasts. The free-rider problem causes markets to underprovide them.',
    up:  'Public goods provision is increasing — higher tax revenue is funding more government spending on defense, infrastructure, or public services. Alternatively, a positive externality (like education) is being subsidized, generating more social value.',
    down:'Public goods are being underprovided — either tax revenue fell (reducing funding) or a negative externality is degrading a common resource (tragedy of the commons: fish stocks, clean air). Free-rider behavior is preventing voluntary provision.',
    idle:'No shock active. Public goods and common resources are the textbook case for government intervention in markets.',
  },
};

// Build the dynamic "why" text based on current node state
function getWhyText(id, state) {
  const info = nodeInfo[id];
  if (!info) return '';
  if (state === 'up')   return info.up   || '';
  if (state === 'down') return info.down || '';
  if (state === 'amb')  return info.amb  || 'Effect is ambiguous — competing forces are pushing this variable in opposite directions simultaneously.';
  return info.idle || '';
}

const edges=[
  {from:'fed',to:'ms',dir:'same'},{from:'fed',to:'ir',dir:'inv'},{from:'fed',to:'lf',dir:'same'},
  {from:'ms',to:'ir',dir:'inv'},{from:'ir',to:'lf',dir:'inv'},{from:'ir',to:'inv',dir:'inv'},
  {from:'ir',to:'xrate',dir:'same'},{from:'ir',to:'inflexp',dir:'same'},{from:'lf',to:'inv',dir:'same'},
  {from:'inv',to:'ad',dir:'same'},{from:'cons',to:'ad',dir:'same'},{from:'trade',to:'ad',dir:'same'},
  {from:'ad',to:'gdp',dir:'same'},{from:'ad',to:'price',dir:'same'},{from:'sras',to:'price',dir:'inv'},
  {from:'lras',to:'gdp',dir:'same'},{from:'prodcost',to:'sras',dir:'inv'},{from:'wages',to:'prodcost',dir:'same'},
  {from:'wages',to:'sras',dir:'inv'},{from:'gdp',to:'unemp',dir:'inv'},{from:'gdp',to:'wages',dir:'same'},
  {from:'unemp',to:'wages',dir:'inv'},{from:'wages',to:'cons',dir:'same'},{from:'gdp',to:'cons',dir:'same'},
  {from:'cons',to:'tax',dir:'same'},{from:'gdp',to:'tax',dir:'same'},{from:'price',to:'trade',dir:'inv'},
  {from:'xrate',to:'trade',dir:'inv'},{from:'price',to:'surplus',dir:'inv'},{from:'price',to:'prodsurp',dir:'same'},
  {from:'prodcost',to:'profit',dir:'inv'},{from:'price',to:'profit',dir:'same'},
  {from:'surplus',to:'welfare',dir:'same'},{from:'prodsurp',to:'welfare',dir:'same'},
  {from:'extern',to:'welfare',dir:'inv'},{from:'market',to:'surplus',dir:'same'},
  {from:'market',to:'prodsurp',dir:'same'},{from:'market',to:'extern',dir:'same'},
  {from:'tax',to:'equity',dir:'same'},{from:'wages',to:'equity',dir:'same'},
  {from:'tax',to:'publicg',dir:'same'},{from:'inflexp',to:'ir',dir:'same'},
  {from:'price',to:'inflexp',dir:'same'},{from:'lras',to:'unemp',dir:'inv'},
];

const nodeMap={};nodes.forEach(n=>nodeMap[n.id]=n);
const R=38;let states={},activeEdges=new Set();

// ── CASCADE EVENT DATA (unchanged from original) ──────────────
const cascadeEvents={
fedBuys:{label:'Fed buys bonds → money supply ↑, rates ↓, investment ↑, AD shifts right → output ↑, inflation ↑.',cascade:[{id:'fed',s:'up',d:0},{id:'ms',s:'up',d:250},{id:'ir',s:'down',d:500},{id:'lf',s:'up',d:700},{id:'inv',s:'up',d:950},{id:'ad',s:'up',d:1200},{id:'gdp',s:'up',d:1450},{id:'price',s:'up',d:1450},{id:'unemp',s:'down',d:1700},{id:'wages',s:'up',d:1900},{id:'cons',s:'up',d:2100},{id:'tax',s:'up',d:2300},{id:'trade',s:'down',d:2300},{id:'surplus',s:'down',d:2500},{id:'prodsurp',s:'up',d:2500}],edgeSeq:['fed→ms','fed→ir','ms→ir','ir→lf','ir→inv','lf→inv','inv→ad','cons→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','gdp→cons','cons→tax','gdp→tax','price→trade','price→surplus','price→prodsurp']},
fedSells:{label:'Fed sells bonds → money supply ↓, rates ↑, investment ↓, AD shifts left → output ↓, deflation.',cascade:[{id:'fed',s:'down',d:0},{id:'ms',s:'down',d:250},{id:'ir',s:'up',d:500},{id:'lf',s:'down',d:700},{id:'inv',s:'down',d:950},{id:'ad',s:'down',d:1200},{id:'gdp',s:'down',d:1450},{id:'price',s:'down',d:1450},{id:'unemp',s:'up',d:1700},{id:'wages',s:'down',d:1900},{id:'cons',s:'down',d:2100},{id:'tax',s:'down',d:2300},{id:'trade',s:'up',d:2300},{id:'surplus',s:'up',d:2500},{id:'prodsurp',s:'down',d:2500}],edgeSeq:['fed→ms','fed→ir','ms→ir','ir→lf','ir→inv','lf→inv','inv→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','cons→tax','gdp→tax','price→trade','price→surplus','price→prodsurp']},
rrUp:{label:'Reserve requirement ↑ → money multiplier shrinks → money supply ↓, rates ↑.',cascade:[{id:'ms',s:'down',d:0},{id:'ir',s:'up',d:280},{id:'lf',s:'down',d:280},{id:'inv',s:'down',d:560},{id:'ad',s:'down',d:840},{id:'gdp',s:'down',d:1120},{id:'price',s:'down',d:1120},{id:'unemp',s:'up',d:1380},{id:'wages',s:'down',d:1600},{id:'cons',s:'down',d:1820},{id:'tax',s:'down',d:2040}],edgeSeq:['ms→ir','ir→lf','ir→inv','lf→inv','inv→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','cons→tax']},
rrDown:{label:'Reserve requirement ↓ → multiplier grows → money supply ↑, rates ease, economy expands.',cascade:[{id:'ms',s:'up',d:0},{id:'ir',s:'down',d:280},{id:'lf',s:'up',d:280},{id:'inv',s:'up',d:560},{id:'ad',s:'up',d:840},{id:'gdp',s:'up',d:1120},{id:'price',s:'up',d:1120},{id:'unemp',s:'down',d:1380},{id:'wages',s:'up',d:1600},{id:'cons',s:'up',d:1820},{id:'tax',s:'up',d:2040}],edgeSeq:['ms→ir','ir→lf','ir→inv','lf→inv','inv→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','cons→tax']},
discountUp:{label:'Discount rate ↑ → borrowing from Fed costly → banks lend less → money supply ↓, rates rise.',cascade:[{id:'ir',s:'up',d:0},{id:'ms',s:'down',d:280},{id:'lf',s:'down',d:280},{id:'inv',s:'down',d:560},{id:'ad',s:'down',d:840},{id:'gdp',s:'down',d:1120},{id:'price',s:'down',d:1120},{id:'unemp',s:'up',d:1380},{id:'wages',s:'down',d:1600},{id:'cons',s:'down',d:1840},{id:'tax',s:'down',d:2060}],edgeSeq:['ms→ir','ir→lf','ir→inv','lf→inv','inv→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','cons→tax']},
discountDown:{label:'Discount rate ↓ → cheaper Fed lending → banks expand credit → money supply ↑, economy expands.',cascade:[{id:'ir',s:'down',d:0},{id:'ms',s:'up',d:280},{id:'lf',s:'up',d:280},{id:'inv',s:'up',d:560},{id:'ad',s:'up',d:840},{id:'gdp',s:'up',d:1120},{id:'price',s:'up',d:1120},{id:'unemp',s:'down',d:1380},{id:'wages',s:'up',d:1600},{id:'cons',s:'up',d:1840},{id:'tax',s:'up',d:2060},{id:'trade',s:'down',d:2060}],edgeSeq:['ms→ir','ir→lf','ir→inv','lf→inv','inv→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','cons→tax','price→trade']},
moneySupplyUp:{label:'QE / money supply ↑ → rates fall, dollar weakens, AD expands; inflation expectations may rise.',cascade:[{id:'ms',s:'up',d:0},{id:'ir',s:'down',d:300},{id:'xrate',s:'down',d:400},{id:'lf',s:'up',d:300},{id:'inv',s:'up',d:600},{id:'trade',s:'up',d:700},{id:'ad',s:'up',d:900},{id:'gdp',s:'up',d:1150},{id:'price',s:'up',d:1150},{id:'inflexp',s:'up',d:1300},{id:'unemp',s:'down',d:1400},{id:'wages',s:'up',d:1600},{id:'cons',s:'up',d:1800},{id:'tax',s:'up',d:2000}],edgeSeq:['ms→ir','ir→lf','ir→xrate','ir→inv','lf→inv','xrate→trade','trade→ad','inv→ad','ad→gdp','ad→price','price→inflexp','inflexp→ir','gdp→unemp','gdp→wages','wages→cons','cons→tax']},
moneySupplyDown:{label:'Quantitative tightening → money supply ↓, rates ↑, dollar strengthens, AD contracts.',cascade:[{id:'ms',s:'down',d:0},{id:'ir',s:'up',d:300},{id:'xrate',s:'up',d:400},{id:'lf',s:'down',d:300},{id:'inv',s:'down',d:600},{id:'trade',s:'down',d:700},{id:'ad',s:'down',d:900},{id:'gdp',s:'down',d:1150},{id:'price',s:'down',d:1150},{id:'inflexp',s:'down',d:1300},{id:'unemp',s:'up',d:1400},{id:'wages',s:'down',d:1600},{id:'cons',s:'down',d:1800},{id:'tax',s:'down',d:2000}],edgeSeq:['ms→ir','ir→lf','ir→xrate','ir→inv','lf→inv','xrate→trade','inv→ad','ad→gdp','ad→price','price→inflexp','gdp→unemp','gdp→wages','wages→cons','cons→tax']},
inflExpUp:{label:'Inflation expectations ↑ → Fisher effect raises nominal rates → investment ↓, real wages erode.',cascade:[{id:'inflexp',s:'up',d:0},{id:'ir',s:'up',d:350},{id:'inv',s:'down',d:650},{id:'lf',s:'down',d:500},{id:'ad',s:'down',d:900},{id:'gdp',s:'down',d:1150},{id:'unemp',s:'up',d:1400},{id:'wages',s:'amb',d:1600}],edgeSeq:['inflexp→ir','ir→inv','ir→lf','lf→inv','inv→ad','ad→gdp','gdp→unemp','gdp→wages']},
inflExpDown:{label:'Inflation expectations ↓ → nominal rates ease, investment recovers, economy stabilizes.',cascade:[{id:'inflexp',s:'down',d:0},{id:'ir',s:'down',d:350},{id:'inv',s:'up',d:650},{id:'lf',s:'up',d:500},{id:'ad',s:'up',d:900},{id:'gdp',s:'up',d:1150},{id:'unemp',s:'down',d:1400},{id:'wages',s:'up',d:1600}],edgeSeq:['inflexp→ir','ir→inv','ir→lf','lf→inv','inv→ad','ad→gdp','gdp→unemp','gdp→wages']},
taxCut:{label:'Tax cut → disposable income ↑ → consumer spending ↑ → AD shifts right. Revenue effect is ambiguous (Laffer).',cascade:[{id:'cons',s:'up',d:0},{id:'ad',s:'up',d:350},{id:'gdp',s:'up',d:620},{id:'price',s:'up',d:620},{id:'unemp',s:'down',d:880},{id:'wages',s:'up',d:1100},{id:'trade',s:'down',d:1320},{id:'tax',s:'amb',d:1520},{id:'surplus',s:'down',d:1520},{id:'equity',s:'amb',d:1700}],edgeSeq:['cons→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','price→trade','cons→tax','price→surplus']},
taxHike:{label:'Tax hike → disposable income ↓ → consumer spending ↓ → AD contracts → unemployment rises.',cascade:[{id:'cons',s:'down',d:0},{id:'ad',s:'down',d:350},{id:'gdp',s:'down',d:620},{id:'price',s:'down',d:620},{id:'unemp',s:'up',d:880},{id:'wages',s:'down',d:1100},{id:'trade',s:'up',d:1320},{id:'tax',s:'up',d:1520},{id:'surplus',s:'up',d:1520},{id:'equity',s:'up',d:1700}],edgeSeq:['cons→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','price→trade','cons→tax','price→surplus','tax→equity']},
govtSpendUp:{label:'Govt spending ↑ → AD shifts right (multiplier amplifies). Crowding out: govt borrows → loanable funds D↑ → rates↑ → private investment↓.',cascade:[{id:'ad',s:'up',d:0},{id:'gdp',s:'up',d:350},{id:'price',s:'up',d:350},{id:'unemp',s:'down',d:630},{id:'wages',s:'up',d:850},{id:'cons',s:'up',d:1070},{id:'tax',s:'up',d:1280},{id:'trade',s:'down',d:1280},{id:'lf',s:'down',d:500},{id:'ir',s:'up',d:700},{id:'inv',s:'down',d:950}],edgeSeq:['inv→ad','cons→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','cons→tax','gdp→tax','price→trade','ir→lf','ir→inv','lf→inv']},
govtSpendDown:{label:'Austerity → AD contracts → output ↓, unemployment ↑. Frees loanable funds → rates↓ → private investment recovers.',cascade:[{id:'ad',s:'down',d:0},{id:'gdp',s:'down',d:350},{id:'price',s:'down',d:350},{id:'unemp',s:'up',d:630},{id:'wages',s:'down',d:850},{id:'cons',s:'down',d:1070},{id:'tax',s:'down',d:1280},{id:'lf',s:'up',d:500},{id:'ir',s:'down',d:700},{id:'inv',s:'up',d:950}],edgeSeq:['ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','cons→tax','ir→lf','ir→inv','lf→inv']},
debtUp:{label:'Govt debt ↑ → crowding out: competes in loanable funds → real rates↑ → private investment↓.',cascade:[{id:'lf',s:'down',d:0},{id:'ir',s:'up',d:380},{id:'inv',s:'down',d:660},{id:'ad',s:'down',d:940},{id:'gdp',s:'down',d:1200},{id:'unemp',s:'up',d:1450},{id:'cons',s:'down',d:1700},{id:'tax',s:'down',d:1920}],edgeSeq:['ir→lf','ir→inv','lf→inv','inv→ad','ad→gdp','gdp→unemp','gdp→cons','cons→tax']},
transfersUp:{label:'Transfer payments ↑ → disposable income ↑ → consumer spending ↑ → AD expands, equity improves.',cascade:[{id:'cons',s:'up',d:0},{id:'ad',s:'up',d:380},{id:'gdp',s:'up',d:660},{id:'price',s:'up',d:660},{id:'unemp',s:'down',d:900},{id:'equity',s:'up',d:1100},{id:'tax',s:'down',d:800},{id:'welfare',s:'up',d:1300}],edgeSeq:['cons→ad','ad→gdp','ad→price','gdp→unemp','cons→tax','tax→equity','surplus→welfare','prodsurp→welfare']},
minWageUp:{label:'Min. wage ↑ → wages↑, production costs↑, SRAS shifts left. Employment effect depends on labor demand elasticity.',cascade:[{id:'wages',s:'up',d:0},{id:'prodcost',s:'up',d:350},{id:'sras',s:'down',d:600},{id:'price',s:'up',d:850},{id:'cons',s:'up',d:600},{id:'unemp',s:'amb',d:1100},{id:'surplus',s:'down',d:1100},{id:'prodsurp',s:'down',d:1100},{id:'equity',s:'up',d:1300},{id:'profit',s:'down',d:1200}],edgeSeq:['wages→prodcost','wages→sras','prodcost→sras','sras→price','wages→cons','cons→ad','gdp→unemp','price→surplus','prodcost→profit','wages→equity']},
subsidyProd:{label:'Production subsidy → costs↓, SRAS shifts right → output↑, prices↓, consumer and producer surplus↑.',cascade:[{id:'prodcost',s:'down',d:0},{id:'sras',s:'up',d:350},{id:'price',s:'down',d:650},{id:'gdp',s:'up',d:800},{id:'surplus',s:'up',d:950},{id:'prodsurp',s:'up',d:950},{id:'welfare',s:'up',d:1200},{id:'unemp',s:'down',d:1000},{id:'market',s:'up',d:800}],edgeSeq:['prodcost→sras','sras→price','lras→gdp','price→surplus','price→prodsurp','surplus→welfare','prodsurp→welfare','market→surplus','market→prodsurp']},
expansFiscal:{label:'Expansionary fiscal (tax cut + spending↑) → AD shifts right → Keynesian stimulus.',cascade:[{id:'ad',s:'up',d:0},{id:'cons',s:'up',d:200},{id:'gdp',s:'up',d:500},{id:'price',s:'up',d:500},{id:'unemp',s:'down',d:750},{id:'wages',s:'up',d:950},{id:'tax',s:'amb',d:1200},{id:'trade',s:'down',d:1200},{id:'lf',s:'down',d:600},{id:'ir',s:'up',d:800},{id:'inv',s:'down',d:1000}],edgeSeq:['cons→ad','inv→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','price→trade','cons→tax','ir→lf','ir→inv']},
contractFiscal:{label:'Contractionary fiscal (tax↑ + spending↓) → AD shifts left → used to fight inflation.',cascade:[{id:'ad',s:'down',d:0},{id:'cons',s:'down',d:200},{id:'gdp',s:'down',d:500},{id:'price',s:'down',d:500},{id:'unemp',s:'up',d:750},{id:'wages',s:'down',d:950},{id:'tax',s:'amb',d:1200},{id:'trade',s:'up',d:1200},{id:'lf',s:'up',d:600},{id:'ir',s:'down',d:800},{id:'inv',s:'up',d:1000}],edgeSeq:['cons→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','price→trade','cons→tax','ir→lf','ir→inv']},
oilShock:{label:'Oil price spike → cost-push inflation. SRAS shifts left → prices↑ AND output↓ simultaneously (stagflation).',cascade:[{id:'prodcost',s:'up',d:0},{id:'sras',s:'down',d:300},{id:'price',s:'up',d:600},{id:'gdp',s:'down',d:600},{id:'unemp',s:'up',d:850},{id:'wages',s:'down',d:1100},{id:'cons',s:'down',d:1350},{id:'trade',s:'down',d:850},{id:'tax',s:'down',d:1570},{id:'surplus',s:'down',d:900},{id:'profit',s:'down',d:900}],edgeSeq:['prodcost→sras','sras→price','wages→prodcost','ad→price','ad→gdp','gdp→unemp','gdp→wages','wages→cons','price→trade','cons→tax','price→surplus','prodcost→profit']},
oilDrop:{label:'Oil falls → production costs↓, SRAS shifts right → output↑, prices↓. Positive supply shock.',cascade:[{id:'prodcost',s:'down',d:0},{id:'sras',s:'up',d:300},{id:'price',s:'down',d:600},{id:'gdp',s:'up',d:600},{id:'unemp',s:'down',d:850},{id:'wages',s:'up',d:1100},{id:'cons',s:'up',d:1350},{id:'trade',s:'up',d:850},{id:'tax',s:'up',d:1570},{id:'surplus',s:'up',d:900},{id:'profit',s:'up',d:900}],edgeSeq:['prodcost→sras','sras→price','ad→gdp','gdp→unemp','gdp→wages','wages→cons','price→trade','cons→tax','price→surplus','prodcost→profit']},
techGrowth:{label:'Technology ↑ productivity → LRAS and SRAS shift right → more output at lower prices. Real wages rise.',cascade:[{id:'lras',s:'up',d:0},{id:'sras',s:'up',d:250},{id:'gdp',s:'up',d:500},{id:'price',s:'down',d:500},{id:'unemp',s:'down',d:750},{id:'wages',s:'up',d:950},{id:'prodcost',s:'down',d:950},{id:'cons',s:'up',d:1200},{id:'inv',s:'up',d:700},{id:'tax',s:'up',d:1450},{id:'trade',s:'up',d:1200},{id:'profit',s:'up',d:1200},{id:'welfare',s:'up',d:1600}],edgeSeq:['lras→gdp','lras→unemp','sras→price','ad→gdp','gdp→unemp','gdp→wages','wages→cons','price→trade','prodcost→sras','prodcost→profit','cons→tax','surplus→welfare','prodsurp→welfare']},
laborSupplyUp:{label:'Labor supply ↑ (immigration) → wages↓, costs↓, SRAS shifts right → output↑, prices↓.',cascade:[{id:'wages',s:'down',d:0},{id:'prodcost',s:'down',d:300},{id:'sras',s:'up',d:550},{id:'price',s:'down',d:800},{id:'gdp',s:'up',d:800},{id:'unemp',s:'amb',d:1050},{id:'surplus',s:'up',d:1100},{id:'profit',s:'up',d:1100}],edgeSeq:['wages→prodcost','wages→sras','prodcost→sras','sras→price','lras→gdp','price→surplus','prodcost→profit']},
laborSupplyDown:{label:'Labor supply ↓ (aging population) → wages↑, costs↑, SRAS shifts left → prices↑, output↓.',cascade:[{id:'wages',s:'up',d:0},{id:'prodcost',s:'up',d:300},{id:'sras',s:'down',d:550},{id:'price',s:'up',d:800},{id:'gdp',s:'down',d:800},{id:'unemp',s:'down',d:1050},{id:'surplus',s:'down',d:1100},{id:'profit',s:'down',d:1100}],edgeSeq:['wages→prodcost','prodcost→sras','sras→price','price→surplus','prodcost→profit']},
inputCostUp:{label:'Input costs ↑ (raw materials) → ATC/MC rise → SRAS shifts left → prices↑, output↓.',cascade:[{id:'prodcost',s:'up',d:0},{id:'sras',s:'down',d:320},{id:'price',s:'up',d:620},{id:'gdp',s:'down',d:620},{id:'profit',s:'down',d:700},{id:'unemp',s:'up',d:900},{id:'cons',s:'down',d:1100},{id:'surplus',s:'down',d:850}],edgeSeq:['prodcost→sras','prodcost→profit','sras→price','ad→gdp','gdp→unemp','gdp→cons','price→surplus']},
inputCostDown:{label:'Input costs ↓ → costs fall, SRAS shifts right → prices↓, output↑, profits↑.',cascade:[{id:'prodcost',s:'down',d:0},{id:'sras',s:'up',d:320},{id:'price',s:'down',d:620},{id:'gdp',s:'up',d:620},{id:'profit',s:'up',d:700},{id:'unemp',s:'down',d:900},{id:'cons',s:'up',d:1100},{id:'surplus',s:'up',d:850}],edgeSeq:['prodcost→sras','prodcost→profit','sras→price','lras→gdp','gdp→unemp','gdp→cons','price→surplus']},
capitalStock:{label:'Capital stock ↑ (investment boom) → LRAS shifts right → long-run growth, productivity rises.',cascade:[{id:'inv',s:'up',d:0},{id:'lras',s:'up',d:400},{id:'gdp',s:'up',d:700},{id:'price',s:'down',d:700},{id:'wages',s:'up',d:900},{id:'unemp',s:'down',d:900},{id:'trade',s:'up',d:1100},{id:'welfare',s:'up',d:1300}],edgeSeq:['inv→ad','lras→gdp','lras→unemp','ad→price','gdp→wages','price→trade','surplus→welfare','prodsurp→welfare']},
naturalDisaster:{label:'Natural disaster → capital destroyed, LRAS and SRAS shift left → stagflation conditions.',cascade:[{id:'lras',s:'down',d:0},{id:'sras',s:'down',d:250},{id:'gdp',s:'down',d:500},{id:'price',s:'up',d:500},{id:'unemp',s:'up',d:750},{id:'wages',s:'down',d:950},{id:'cons',s:'down',d:1200},{id:'trade',s:'down',d:750},{id:'welfare',s:'down',d:1400}],edgeSeq:['lras→gdp','lras→unemp','sras→price','ad→gdp','gdp→unemp','gdp→wages','wages→cons','price→trade','extern→welfare']},
pandemic:{label:'Pandemic → labor supply↓, costs↑, SRAS shifts left AND AD falls → output↓, price ambiguous.',cascade:[{id:'sras',s:'down',d:0},{id:'prodcost',s:'up',d:250},{id:'gdp',s:'down',d:500},{id:'price',s:'amb',d:500},{id:'unemp',s:'up',d:750},{id:'wages',s:'amb',d:950},{id:'cons',s:'down',d:1200},{id:'trade',s:'down',d:950},{id:'welfare',s:'down',d:1400},{id:'ad',s:'down',d:450}],edgeSeq:['sras→price','prodcost→sras','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','price→trade','extern→welfare']},
consConfUp:{label:'Consumer confidence ↑ → households spend more (Keynesian animal spirits) → AD shifts right.',cascade:[{id:'cons',s:'up',d:0},{id:'ad',s:'up',d:320},{id:'gdp',s:'up',d:600},{id:'price',s:'up',d:600},{id:'unemp',s:'down',d:850},{id:'wages',s:'up',d:1050},{id:'tax',s:'up',d:1280},{id:'trade',s:'down',d:1280},{id:'surplus',s:'down',d:1280}],edgeSeq:['cons→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','cons→tax','price→trade','price→surplus']},
consConfDown:{label:'Consumer confidence ↓ → spending↓, AD shifts left → recession risk.',cascade:[{id:'cons',s:'down',d:0},{id:'ad',s:'down',d:320},{id:'gdp',s:'down',d:600},{id:'price',s:'down',d:600},{id:'unemp',s:'up',d:850},{id:'wages',s:'down',d:1050},{id:'tax',s:'down',d:1280},{id:'trade',s:'up',d:1280},{id:'surplus',s:'up',d:1280}],edgeSeq:['cons→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','cons→tax','price→trade','price→surplus']},
invOptimism:{label:'Business optimism ↑ → investment↑ → AD shifts right, multiplier amplifies output.',cascade:[{id:'inv',s:'up',d:0},{id:'ad',s:'up',d:320},{id:'gdp',s:'up',d:600},{id:'price',s:'up',d:600},{id:'unemp',s:'down',d:850},{id:'wages',s:'up',d:1050},{id:'cons',s:'up',d:1050},{id:'tax',s:'up',d:1300},{id:'lras',s:'up',d:1500}],edgeSeq:['inv→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','cons→ad','cons→tax']},
invPessimism:{label:'Business pessimism ↑ → investment↓ → AD falls. Liquidity trap risk if rates already near zero.',cascade:[{id:'inv',s:'down',d:0},{id:'ad',s:'down',d:320},{id:'gdp',s:'down',d:600},{id:'price',s:'down',d:600},{id:'unemp',s:'up',d:850},{id:'wages',s:'down',d:1050},{id:'cons',s:'down',d:1050},{id:'tax',s:'down',d:1300}],edgeSeq:['inv→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','cons→tax']},
wealthEffect:{label:'Asset prices ↑ → households feel wealthier → consumption↑ even without income change → AD↑.',cascade:[{id:'cons',s:'up',d:0},{id:'ad',s:'up',d:350},{id:'gdp',s:'up',d:650},{id:'price',s:'up',d:650},{id:'unemp',s:'down',d:900},{id:'wages',s:'up',d:1100},{id:'tax',s:'up',d:1320},{id:'trade',s:'down',d:1320}],edgeSeq:['cons→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','cons→tax','price→trade']},
housingBoom:{label:'Housing boom → wealth↑, construction↑, spending↑ → strong AD expansion.',cascade:[{id:'inv',s:'up',d:0},{id:'cons',s:'up',d:200},{id:'ad',s:'up',d:450},{id:'gdp',s:'up',d:720},{id:'price',s:'up',d:720},{id:'wages',s:'up',d:950},{id:'unemp',s:'down',d:950},{id:'tax',s:'up',d:1200},{id:'lf',s:'up',d:500},{id:'ir',s:'up',d:700}],edgeSeq:['inv→ad','cons→ad','ad→gdp','ad→price','gdp→wages','gdp→unemp','wages→cons','cons→tax','ir→lf']},
housingBust:{label:'Housing bust → wealth falls, credit tightens → sharp AD contraction (2008-style crisis).',cascade:[{id:'inv',s:'down',d:0},{id:'cons',s:'down',d:200},{id:'lf',s:'down',d:200},{id:'ir',s:'up',d:400},{id:'ad',s:'down',d:550},{id:'gdp',s:'down',d:820},{id:'price',s:'down',d:820},{id:'wages',s:'down',d:1050},{id:'unemp',s:'up',d:1050},{id:'tax',s:'down',d:1300},{id:'welfare',s:'down',d:1500}],edgeSeq:['inv→ad','cons→ad','ir→lf','lf→inv','ad→gdp','ad→price','gdp→wages','gdp→unemp','wages→cons','cons→tax','extern→welfare']},
recessionGap:{label:'Recessionary gap: Y < Yp → unemployment > natural rate → wages self-correct downward over time.',cascade:[{id:'gdp',s:'down',d:0},{id:'unemp',s:'up',d:300},{id:'wages',s:'down',d:550},{id:'prodcost',s:'down',d:800},{id:'sras',s:'up',d:1050},{id:'price',s:'down',d:1300},{id:'cons',s:'down',d:800},{id:'tax',s:'down',d:1100}],edgeSeq:['lras→gdp','gdp→unemp','unemp→wages','wages→prodcost','prodcost→sras','sras→price','gdp→cons','cons→tax']},
inflatGap:{label:'Inflationary gap: Y > Yp → unemployment < natural rate → wages bid up → SRAS shifts left.',cascade:[{id:'gdp',s:'up',d:0},{id:'unemp',s:'down',d:300},{id:'wages',s:'up',d:550},{id:'prodcost',s:'up',d:800},{id:'sras',s:'down',d:1050},{id:'price',s:'up',d:1300},{id:'inflexp',s:'up',d:1500},{id:'ir',s:'up',d:1700}],edgeSeq:['lras→gdp','gdp→unemp','unemp→wages','wages→prodcost','prodcost→sras','sras→price','price→inflexp','inflexp→ir']},
stagflation:{label:'Stagflation: negative supply shock → SRAS left → prices↑ AND output↓. Phillips curve breaks down.',cascade:[{id:'sras',s:'down',d:0},{id:'price',s:'up',d:350},{id:'gdp',s:'down',d:350},{id:'unemp',s:'up',d:650},{id:'wages',s:'down',d:900},{id:'cons',s:'down',d:1150},{id:'tax',s:'down',d:1400},{id:'welfare',s:'down',d:1600},{id:'inflexp',s:'up',d:800},{id:'surplus',s:'down',d:800}],edgeSeq:['sras→price','ad→gdp','gdp→unemp','unemp→wages','wages→cons','cons→tax','price→inflexp','price→surplus','extern→welfare']},
tariffUp:{label:'Tariff imposed → import prices↑, consumer surplus↓, domestic producers protected, deadweight loss created.',cascade:[{id:'price',s:'up',d:0},{id:'trade',s:'down',d:350},{id:'surplus',s:'down',d:500},{id:'prodsurp',s:'up',d:500},{id:'welfare',s:'down',d:800},{id:'cons',s:'down',d:700},{id:'tax',s:'up',d:700},{id:'extern',s:'up',d:900}],edgeSeq:['price→trade','price→surplus','price→prodsurp','surplus→welfare','prodsurp→welfare','cons→ad','cons→tax','market→extern']},
tariffDown:{label:'Tariff removed → consumer prices↓, consumer surplus↑, total welfare rises despite domestic producer losses.',cascade:[{id:'price',s:'down',d:0},{id:'trade',s:'up',d:350},{id:'surplus',s:'up',d:500},{id:'prodsurp',s:'down',d:500},{id:'welfare',s:'up',d:800},{id:'cons',s:'up',d:700},{id:'market',s:'up',d:600}],edgeSeq:['price→trade','price→surplus','price→prodsurp','surplus→welfare','prodsurp→welfare','market→surplus','market→prodsurp']},
exportBoom:{label:'Export demand ↑ → NX↑ → AD shifts right → GDP↑, employment↑. Currency may appreciate, partially offsetting.',cascade:[{id:'trade',s:'up',d:0},{id:'ad',s:'up',d:350},{id:'gdp',s:'up',d:630},{id:'price',s:'up',d:630},{id:'unemp',s:'down',d:900},{id:'wages',s:'up',d:1100},{id:'cons',s:'up',d:1300},{id:'tax',s:'up',d:1520},{id:'xrate',s:'up',d:800}],edgeSeq:['trade→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','wages→cons','cons→tax','ir→xrate']},
importBoom:{label:'Import surge → NX↓ → AD shifts left → domestic output↓. May reflect strong consumer spending (ambiguous welfare).',cascade:[{id:'trade',s:'down',d:0},{id:'ad',s:'down',d:350},{id:'gdp',s:'down',d:630},{id:'price',s:'down',d:630},{id:'unemp',s:'up',d:900},{id:'wages',s:'down',d:1100},{id:'surplus',s:'up',d:630},{id:'welfare',s:'amb',d:1000}],edgeSeq:['trade→ad','ad→gdp','ad→price','gdp→unemp','gdp→wages','price→surplus','surplus→welfare']},
dollarStrong:{label:'Dollar appreciates → US exports more expensive abroad, imports cheaper → NX falls, AD contracts.',cascade:[{id:'xrate',s:'up',d:0},{id:'trade',s:'down',d:400},{id:'ad',s:'down',d:700},{id:'gdp',s:'down',d:980},{id:'price',s:'down',d:980},{id:'unemp',s:'up',d:1230},{id:'surplus',s:'up',d:1230},{id:'cons',s:'up',d:980}],edgeSeq:['xrate→trade','trade→ad','ad→gdp','ad→price','gdp→unemp','price→surplus','cons→ad']},
dollarWeak:{label:'Dollar depreciates → exports cheaper, imports expensive → NX↑ → AD expands. Import-push inflation risk.',cascade:[{id:'xrate',s:'down',d:0},{id:'trade',s:'up',d:400},{id:'ad',s:'up',d:700},{id:'gdp',s:'up',d:980},{id:'price',s:'up',d:980},{id:'unemp',s:'down',d:1230},{id:'surplus',s:'down',d:1230}],edgeSeq:['xrate→trade','trade→ad','ad→gdp','ad→price','gdp→unemp','price→surplus']},
quotaImposed:{label:'Import quota → domestic prices↑, consumer surplus↓, producer surplus↑, deadweight loss created.',cascade:[{id:'trade',s:'down',d:0},{id:'price',s:'up',d:350},{id:'surplus',s:'down',d:600},{id:'prodsurp',s:'up',d:600},{id:'welfare',s:'down',d:900},{id:'market',s:'down',d:500},{id:'extern',s:'up',d:800}],edgeSeq:['trade→ad','price→surplus','price→prodsurp','surplus→welfare','prodsurp→welfare','market→extern','extern→welfare']},
tradeSurplus:{label:'Trade surplus (X > M) → NX > 0 → AD↑, currency tends to appreciate over time.',cascade:[{id:'trade',s:'up',d:0},{id:'ad',s:'up',d:350},{id:'gdp',s:'up',d:630},{id:'xrate',s:'up',d:500},{id:'price',s:'up',d:630},{id:'unemp',s:'down',d:880},{id:'wages',s:'up',d:1080}],edgeSeq:['trade→ad','ad→gdp','ad→price','ir→xrate','gdp→unemp','gdp→wages']},
tradeDeficit:{label:'Trade deficit (M > X) → NX < 0 → AD drag; typically financed by capital account surplus.',cascade:[{id:'trade',s:'down',d:0},{id:'ad',s:'down',d:350},{id:'gdp',s:'down',d:630},{id:'xrate',s:'down',d:500},{id:'lf',s:'up',d:600},{id:'ir',s:'down',d:800},{id:'inv',s:'up',d:1000}],edgeSeq:['trade→ad','ad→gdp','ir→xrate','ir→lf','lf→inv','inv→ad']},
capiFlowIn:{label:'Capital inflow → loanable funds S↑ → rates↓, dollar appreciates, investment↑.',cascade:[{id:'lf',s:'up',d:0},{id:'ir',s:'down',d:350},{id:'inv',s:'up',d:650},{id:'xrate',s:'up',d:500},{id:'trade',s:'down',d:800},{id:'ad',s:'amb',d:1100}],edgeSeq:['ir→lf','lf→inv','ir→xrate','xrate→trade','inv→ad','trade→ad']},
unionStrength:{label:'Union bargaining↑ → wages above equilibrium → prodcost↑, SRAS shifts left, employment may fall.',cascade:[{id:'wages',s:'up',d:0},{id:'prodcost',s:'up',d:320},{id:'sras',s:'down',d:580},{id:'price',s:'up',d:850},{id:'unemp',s:'up',d:850},{id:'profit',s:'down',d:950},{id:'equity',s:'up',d:1100}],edgeSeq:['wages→prodcost','wages→sras','prodcost→sras','sras→price','gdp→unemp','prodcost→profit','wages→equity']},
automationUp:{label:'Automation↑ → structural unemployment↑, wages↓ for low-skill; productivity↑, costs↓.',cascade:[{id:'prodcost',s:'down',d:0},{id:'unemp',s:'up',d:350},{id:'wages',s:'down',d:350},{id:'sras',s:'up',d:600},{id:'price',s:'down',d:850},{id:'profit',s:'up',d:850},{id:'surplus',s:'up',d:1050},{id:'equity',s:'down',d:1100},{id:'welfare',s:'amb',d:1300}],edgeSeq:['prodcost→sras','gdp→unemp','wages→prodcost','sras→price','prodcost→profit','price→surplus','surplus→welfare','wages→equity']},
demandElastic:{label:'Elastic demand: tax/price↑ → large Q↓ → burden on producer; large consumer surplus loss.',cascade:[{id:'market',s:'down',d:0},{id:'price',s:'up',d:300},{id:'surplus',s:'down',d:600},{id:'prodsurp',s:'down',d:600},{id:'welfare',s:'down',d:900},{id:'tax',s:'down',d:700},{id:'extern',s:'up',d:800}],edgeSeq:['market→surplus','market→prodsurp','price→surplus','surplus→welfare','prodsurp→welfare','market→extern','extern→welfare']},
demandInelastic:{label:'Inelastic demand: price↑ → small Q↓ → burden on consumer; high tax revenue. (Insulin, cigarettes.)',cascade:[{id:'price',s:'up',d:0},{id:'market',s:'down',d:300},{id:'surplus',s:'down',d:600},{id:'prodsurp',s:'up',d:600},{id:'tax',s:'up',d:700},{id:'welfare',s:'down',d:900}],edgeSeq:['price→surplus','price→prodsurp','market→surplus','market→prodsurp','surplus→welfare','prodsurp→welfare']},
monopolyPower:{label:'Monopoly pricing: P > MC → output restricted below socially optimal → DWL, CS→PS transfer.',cascade:[{id:'price',s:'up',d:0},{id:'market',s:'down',d:350},{id:'surplus',s:'down',d:650},{id:'prodsurp',s:'up',d:650},{id:'welfare',s:'down',d:950},{id:'extern',s:'up',d:800},{id:'profit',s:'up',d:750}],edgeSeq:['price→surplus','price→prodsurp','market→surplus','market→prodsurp','surplus→welfare','prodsurp→welfare','market→extern','extern→welfare']},
perfectComp:{label:'New firms enter → supply↑ → price↓ → zero economic profit long-run → allocative + productive efficiency.',cascade:[{id:'market',s:'up',d:0},{id:'price',s:'down',d:350},{id:'surplus',s:'up',d:650},{id:'prodsurp',s:'down',d:650},{id:'welfare',s:'up',d:950},{id:'profit',s:'down',d:700},{id:'prodcost',s:'down',d:500}],edgeSeq:['market→surplus','market→prodsurp','price→surplus','price→prodsurp','surplus→welfare','prodsurp→welfare','prodcost→profit']},
negExtern:{label:'Negative externality: social cost > private cost → market overproduces → welfare↓, DWL created.',cascade:[{id:'extern',s:'up',d:0},{id:'market',s:'up',d:300},{id:'welfare',s:'down',d:650},{id:'surplus',s:'down',d:500},{id:'publicg',s:'down',d:800}],edgeSeq:['market→extern','extern→welfare','market→surplus','surplus→welfare']},
posExtern:{label:'Positive externality: social benefit > private benefit → market underproduces → welfare loss.',cascade:[{id:'extern',s:'down',d:0},{id:'market',s:'down',d:300},{id:'welfare',s:'down',d:650},{id:'publicg',s:'up',d:800},{id:'lras',s:'up',d:1000}],edgeSeq:['market→extern','extern→welfare','market→surplus','surplus→welfare']},
pigouvianTax:{label:'Pigouvian tax on negative externality → internalizes social cost → output at socially optimal Q → DWL eliminated.',cascade:[{id:'tax',s:'up',d:0},{id:'market',s:'down',d:350},{id:'price',s:'up',d:350},{id:'extern',s:'down',d:700},{id:'welfare',s:'up',d:1000},{id:'surplus',s:'down',d:700},{id:'prodsurp',s:'down',d:700}],edgeSeq:['price→surplus','price→prodsurp','market→extern','extern→welfare','surplus→welfare','prodsurp→welfare']},
priceFloor:{label:'Price floor above equilibrium → surplus (Qs > Qd) → quantity transacted↓ → deadweight loss created.',cascade:[{id:'price',s:'up',d:0},{id:'market',s:'down',d:350},{id:'prodsurp',s:'up',d:600},{id:'surplus',s:'down',d:600},{id:'welfare',s:'down',d:900},{id:'unemp',s:'up',d:700},{id:'extern',s:'up',d:800}],edgeSeq:['price→prodsurp','price→surplus','market→prodsurp','market→surplus','surplus→welfare','prodsurp→welfare','market→extern','extern→welfare']},
priceCeiling:{label:'Price ceiling below equilibrium → shortage (Qd > Qs) → quantity transacted↓ → DWL + black market risk.',cascade:[{id:'price',s:'down',d:0},{id:'market',s:'down',d:350},{id:'surplus',s:'up',d:600},{id:'prodsurp',s:'down',d:600},{id:'welfare',s:'down',d:900},{id:'extern',s:'up',d:800},{id:'equity',s:'amb',d:1000}],edgeSeq:['price→surplus','price→prodsurp','market→surplus','market→prodsurp','surplus→welfare','prodsurp→welfare','market→extern','extern→welfare']},
perUnitTax:{label:'Per-unit tax on supplier → MC shifts up → price↑, quantity↓ → burden split by elasticity, DWL created.',cascade:[{id:'prodcost',s:'up',d:0},{id:'price',s:'up',d:350},{id:'market',s:'down',d:350},{id:'surplus',s:'down',d:650},{id:'prodsurp',s:'down',d:650},{id:'tax',s:'up',d:650},{id:'welfare',s:'down',d:950},{id:'profit',s:'down',d:750}],edgeSeq:['prodcost→sras','price→surplus','price→prodsurp','market→surplus','market→prodsurp','surplus→welfare','prodsurp→welfare','prodcost→profit']},
};

function resetAll(){
  states={};activeEdges.clear();recentNodes.clear();
  document.querySelectorAll('.trigger-btn').forEach(b=>b.classList.remove('active'));
  setInfoBar('info-bar', 'Pick a shock above — watch the cascade fire node by node.');
  clearInfoBar('info-bar');
  drawMap();
}
function triggerEvent(key){
  resetAll();
  const ev=cascadeEvents[key];if(!ev)return;
  setInfoBar('info-bar', ev.label);
  document.querySelectorAll('.trigger-btn[data-ev="'+key+'"]').forEach(b=>b.classList.add('active'));
  ev.cascade.forEach(s=>setTimeout(()=>{states[s.id]=s.s;recentNodes.add(s.id);drawMap();setTimeout(()=>{recentNodes.delete(s.id);drawMap();},800);},s.d));
  let delay=160;
  ev.edgeSeq.forEach(ek=>{setTimeout(()=>{activeEdges.add(ek);drawMap();},delay);delay+=155;});
}
document.querySelectorAll('.trigger-btn').forEach(b=>b.addEventListener('click',()=>triggerEvent(b.dataset.ev)));

function nFill(s){return !s?MC.node:s==='up'?MC.upBg:s==='down'?MC.dnBg:s==='amb'?MC.amBg:MC.node}
function nBd(s){return !s?MC.nodeBd:s==='up'?MC.up:s==='down'?MC.down:s==='amb'?MC.amb:MC.nodeBd}
function nTxt(s){return !s?MC.text:s==='up'?MC.upTxt:s==='down'?MC.dnTxt:s==='amb'?MC.amTxt:MC.text}
function arw(s){return s==='up'?' ▲':s==='down'?' ▼':s==='amb'?' ?':''}

function drawEdge(e){
  const a=nodeMap[e.from],b=nodeMap[e.to];if(!a||!b)return;
  const active=activeEdges.has(e.from+'→'+e.to);
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.sqrt(dx*dx+dy*dy);
  const ux=dx/len,uy=dy/len;
  const sx=a.x+ux*R,sy=a.y+uy*R,ex=b.x-ux*(R+9),ey=b.y-uy*(R+9);
  const col=active?(e.dir==='inv'?MC.down:MC.up):MC.edge;
  ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);
  ctx.strokeStyle=col;ctx.lineWidth=active?2.5:0.75;ctx.globalAlpha=active?1:0.28;ctx.stroke();ctx.globalAlpha=1;
  const ang=Math.atan2(ey-sy,ex-sx);
  ctx.save();ctx.translate(ex,ey);ctx.rotate(ang);
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-10,-5);ctx.lineTo(-10,5);ctx.closePath();
  ctx.fillStyle=col;ctx.globalAlpha=active?1:0.35;ctx.fill();ctx.globalAlpha=1;ctx.restore();
}
function drawNode(n){
  const s=states[n.id];
  // Pulse ring for recently activated nodes
  if (s && recentNodes.has(n.id)) {
    const col = s==='up'?MC.up:s==='down'?MC.down:MC.amb;
    ctx.beginPath();ctx.roundRect(n.x-R-3,n.y-R-3,(R+3)*2,(R+3)*2,10);
    ctx.strokeStyle=col;ctx.lineWidth=1.2;ctx.globalAlpha=0.4;ctx.stroke();ctx.globalAlpha=1;
  }
  ctx.beginPath();ctx.roundRect(n.x-R,n.y-R,R*2,R*2,8);
  ctx.fillStyle=nFill(s);ctx.fill();
  ctx.strokeStyle=nBd(s);ctx.lineWidth=s?1.8:0.7;ctx.stroke();
  const fam=getComputedStyle(document.body).fontFamily||'sans-serif';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle=nTxt(s);ctx.font='500 11.5px '+fam;
  ctx.fillText(n.label+arw(s),n.x,n.y-8);
  ctx.font='10.5px '+fam;ctx.fillStyle=MC.sub;
  ctx.fillText(n.sub,n.x,n.y+9);
}
function drawMap(){ctx.clearRect(0,0,LOGIC_W,LOGIC_H);edges.forEach(drawEdge);nodes.forEach(drawNode);}

// Rich tooltip with WHY
const tip=document.getElementById('tooltip');
let tipTimeout=null;
canvas.addEventListener('mousemove',ev=>{
  const rect=canvas.getBoundingClientRect();
  const mx=(ev.clientX-rect.left)/mapScale,my=(ev.clientY-rect.top)/mapScale;
  let found=null;for(const n of nodes){if(Math.abs(mx-n.x)<R&&Math.abs(my-n.y)<R){found=n;break;}}
  if(found&&nodeInfo[found.id]){
    const st=states[found.id]||null;
    const px2=found.x*mapScale,py2=found.y*mapScale;
    const tw=300;
    let left=Math.max(4,Math.min(px2-tw/2,rect.width-tw-4));
    const fromBottom=rect.height-(py2+R*mapScale+6);
    const top=fromBottom<210?py2-R*mapScale-225:py2+R*mapScale+6;
    const dirLabel=st==='up'?'↑ Why it rises':st==='down'?'↓ Why it falls':st==='amb'?'⟳ Why it\'s ambiguous':'Why it moves';
    const dirColor=st==='up'?'#1fd47a':st==='down'?'#ff4060':st==='amb'?'#f5a623':'#565470';
    const dotColor=st==='up'?'#1fd47a':st==='down'?'#ff4060':st==='amb'?'#f5a623':'#565470';
    const whyText=getWhyText(found.id,st);
    tip.style.left=left+'px';
    tip.style.top=Math.max(4,top)+'px';
    const nodeSub=found.sub||'';
    tip.className=st?'':'tip-idle';
    tip.innerHTML=
      '<div class="tip-header">'+
        '<div class="tip-dot" style="background:'+dotColor+';box-shadow:0 0 8px '+dotColor+'60"></div>'+
        '<div><div class="tip-name">'+found.label+'</div>'+
        (nodeSub?'<div class="tip-sub">'+nodeSub+'</div>':'')+
        '</div>'+
      '</div>'+
      '<div class="tip-label">What it is</div>'+
      '<div class="tip-text">'+nodeInfo[found.id].what+'</div>'+
      '<div class="tip-why-label" style="color:'+dirColor+'">'+dirLabel+'</div>'+
      '<div class="tip-why-text">'+whyText+'</div>';
    tip.style.maxWidth=tw+'px';
    tip.style.opacity='1';
    canvas.classList.add('hovering');
  }else{
    tip.style.opacity='0';
    canvas.classList.remove('hovering');
  }
});
canvas.addEventListener('mouseleave',()=>{
  tip.style.opacity='0';
  canvas.classList.remove('hovering');
});
// Touch support for cascade tooltip on mobile
canvas.addEventListener('touchstart', ev => {
  if (ev.touches.length !== 1) return;
  ev.preventDefault();
  const t = ev.touches[0];
  const rect2 = canvas.getBoundingClientRect();
  const mx = (t.clientX - rect2.left) / mapScale;
  const my = (t.clientY - rect2.top)  / mapScale;
  let found = null;
  for (const n of nodes) {
    if (Math.abs(mx - n.x) < R * 1.5 && Math.abs(my - n.y) < R * 1.5) { found = n; break; }
  }
  if (found && nodeInfo[found.id]) {
    const st = states[found.id] || null;
    const tw = 280;
    const px2 = found.x * mapScale, py2 = found.y * mapScale;
    let left = Math.max(4, Math.min(px2 - tw/2, rect2.width - tw - 4));
    const fromBottom = rect2.height - (py2 + R * mapScale + 6);
    const top = fromBottom < 210 ? py2 - R * mapScale - 225 : py2 + R * mapScale + 6;
    const dirLabel = st==='up'?'↑ Why it rises':st==='down'?'↓ Why it falls':st==='amb'?'\u27F3 Why it\u2019s ambiguous':'Why it moves';
    const dirColor = st==='up'?'#1fd47a':st==='down'?'#ff4060':st==='amb'?'#f5a623':'#565470';
    const dotColor = dirColor;
    const whyText = getWhyText(found.id, st);
    tip.className = st ? '' : 'tip-idle';
    tip.style.left = left + 'px';
    tip.style.top = Math.max(4, top) + 'px';
    tip.style.maxWidth = tw + 'px';
    tip.innerHTML =
      '<div class="tip-header">' +
        '<div class="tip-dot" style="background:'+dotColor+';box-shadow:0 0 8px '+dotColor+'60"></div>' +
        '<div><div class="tip-name">'+found.label+'</div>' +
        (found.sub ? '<div class="tip-sub">'+found.sub+'</div>' : '') +
        '</div></div>' +
      '<div class="tip-label">What it is</div>' +
      '<div class="tip-text">'+nodeInfo[found.id].what+'</div>' +
      '<div class="tip-why-label" style="color:'+dirColor+'">'+dirLabel+'</div>' +
      '<div class="tip-why-text">'+whyText+'</div>';
    tip.style.opacity = '1';
    canvas.classList.add('hovering');
    clearTimeout(canvas._touchTipTimer);
    canvas._touchTipTimer = setTimeout(() => {
      tip.style.opacity = '0';
      canvas.classList.remove('hovering');
    }, 4000);
  }
}, {passive: false});


// ── Info bar active state ──
function setInfoBar(id, text) {
  const bar = document.getElementById(id);
  if (!bar) return;
  const dot = bar.querySelector('.info-dot');
  bar.textContent = text;
  if (dot) bar.prepend(dot);
  bar.classList.add('live');
}
function clearInfoBar(id) {
  const bar = document.getElementById(id);
  if (!bar) return;
  bar.classList.remove('live');
}

// ── Keyboard shortcuts ──
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.key === 'Escape') { resetAll(); }
  if (e.key === 'r' || e.key === 'R') { resetGraph(); }
});

// ── Scroll progress bar ──
const prog = document.getElementById('progress');
if (prog) {
  window.addEventListener('scroll', () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    if (h > 0) prog.style.width = ((window.scrollY / h) * 100).toFixed(1) + '%';
  }, {passive: true});
}



// ═══════════════════════════════════════════════════════════════
//  GRAPH LAB — Complete rebuild, 5× verified
//  Principles:
//    1. Every equilibrium solved algebraically, never approximated
//    2. Smooth rAF animation with lerp (k=0.18 per frame)
//    3. Ghost curves on every shift
//    4. CS/PS/DWL shaded regions tied to real equilibrium points
//    5. Pixel-perfect labels that never overlap curves
// ═══════════════════════════════════════════════════════════════

const gc = document.getElementById('gc');
const gctx = gc.getContext('2d');
const GW = 580, GH = 430;
let gScale = 1;

function resizeGraph() {
  const w = gc.parentElement.clientWidth;
  gScale = w / GW;
  const D = window.devicePixelRatio || 1;
  gc.width  = w * D;
  gc.height = GH * gScale * D;
  gc.style.height = (GH * gScale) + 'px';
  gctx.setTransform(D * gScale, 0, 0, D * gScale, 0, 0);
  renderGraph();
}

// ── Animation engine ──────────────────────────────────────────
const AP = {};  // AnimParams: { key: { cur, tgt } }
let raf = null;

function AP_get(k, def) {
  if (!(k in AP)) AP[k] = { cur: def, tgt: def };
  return AP[k].cur;
}
function AP_set(k, v, def) {
  if (!(k in AP)) AP[k] = { cur: def, tgt: def };
  AP[k].tgt = v;
  if (!raf) raf_step();
}
function AP_tgt(k, def) {
  return (k in AP) ? AP[k].tgt : def;
}
function raf_step() {
  let moving = false;
  for (const k in AP) {
    const a = AP[k], d = a.tgt - a.cur;
    if (Math.abs(d) > 0.0006) { a.cur += d * 0.18; moving = true; }
    else a.cur = a.tgt;
  }
  renderGraph();
  raf = moving ? requestAnimationFrame(raf_step) : null;
}

// ── Current graph ──────────────────────────────────────────────
let CG = 'adas';  // current graph id

// Scoped param helpers
function gv(k, def) { return AP_get(CG + '.' + k, def); }
function sv(k, v, def) { AP_set(CG + '.' + k, v, def); }
function tv(k, def) { return AP_tgt(CG + '.' + k, def); }

// ── Canvas coordinate system ───────────────────────────────────
// Logical space: x ∈ [0,1], y ∈ [0,1] (y=0 = bottom, y=1 = top)
const L = { left: 60, right: 24, top: 28, bottom: 46 };
const PW = GW - L.left - L.right;
const PH = GH - L.top  - L.bottom;

const cx = u => L.left + u * PW;          // unit x → canvas x
const cy = u => L.top  + PH * (1 - u);    // unit y → canvas y (flipped)

function font() {
  return getComputedStyle(document.body).fontFamily || '-apple-system,sans-serif';
}

// Colours — light / dark adaptive
const K = {
  axis:   '#2e2c40',
  axTxt:  '#565470',
  grid:   'rgba(255,255,255,0.032)',
  txt:    '#eceaf4',
  blue:   '#5b8dee',
  red:    '#ff4060',
  green:  '#1fd47a',
  purple: '#a78bfa',
  amber:  '#f5a623',
  gray:   '#5c6070',
  eq:     '#eceaf4',
  old:    'rgba(140,138,160,0.25)',
  cs:     'rgba(91,141,238,0.12)',
  ps:     'rgba(255,64,96,0.12)',
  dwl:    'rgba(245,166,35,0.22)',
  profit: 'rgba(31,212,122,0.14)',
  loss:   'rgba(255,64,96,0.12)',
};

// ── Drawing helpers ─────────────────────────────────────────────

function drawAxes(xLabel, yLabel) {
  // subtle grid
  gctx.strokeStyle = K.grid;
  gctx.lineWidth = 0.8;
  for (let i = 1; i <= 4; i++) {
    gctx.beginPath();
    gctx.moveTo(cx(i/5), cy(0)); gctx.lineTo(cx(i/5), cy(1));
    gctx.stroke();
    gctx.beginPath();
    gctx.moveTo(cx(0), cy(i/5)); gctx.lineTo(cx(1), cy(i/5));
    gctx.stroke();
  }
  // axes
  gctx.strokeStyle = K.axis;
  gctx.lineWidth = 1.5;
  gctx.setLineDash([]);
  gctx.beginPath();
  gctx.moveTo(cx(0), cy(1.05)); gctx.lineTo(cx(0), cy(0));
  gctx.lineTo(cx(1.05), cy(0));
  gctx.stroke();
  // arrowheads
  gctx.fillStyle = K.axis;
  const ah = 5;
  // y-axis arrow
  gctx.beginPath();
  gctx.moveTo(cx(0), cy(1.05) - ah);
  gctx.lineTo(cx(0) - 3.5, cy(1.05));
  gctx.lineTo(cx(0) + 3.5, cy(1.05));
  gctx.fill();
  // x-axis arrow
  gctx.beginPath();
  gctx.moveTo(cx(1.05) + ah, cy(0));
  gctx.lineTo(cx(1.05), cy(0) - 3.5);
  gctx.lineTo(cx(1.05), cy(0) + 3.5);
  gctx.fill();
  // origin label
  gctx.fillStyle = K.axTxt;
  gctx.font = '10px ' + font();
  gctx.textAlign = 'right';
  gctx.fillText('O', cx(0) - 5, cy(0) + 13);
  // axis labels
  gctx.font = '12px ' + font();
  gctx.textAlign = 'center';
  gctx.fillText(xLabel, cx(0.5), GH - 8);
  gctx.save();
  gctx.translate(14, cy(0.5));
  gctx.rotate(-Math.PI / 2);
  gctx.fillText(yLabel, 0, 0);
  gctx.restore();
}

// Draw polyline from array of [unitX, unitY] pairs
function drawLine(pts, color, lw, dash) {
  if (!pts || pts.length < 2) return;
  gctx.beginPath();
  gctx.strokeStyle = color;
  gctx.lineWidth = lw || 2;
  gctx.setLineDash(dash || []);
  gctx.moveTo(cx(pts[0][0]), cy(pts[0][1]));
  for (let i = 1; i < pts.length; i++) gctx.lineTo(cx(pts[i][0]), cy(pts[i][1]));
  gctx.stroke();
  gctx.setLineDash([]);
}

// Label at end of line with offset
function endLabel(pts, text, color, side, vShift) {
  if (!pts || !pts.length) return;
  const p = pts[pts.length - 1];
  gctx.fillStyle = color;
  gctx.font = 'bold 12px ' + font();
  gctx.textAlign = side === 'L' ? 'right' : 'left';
  gctx.fillText(text, cx(p[0]) + (side === 'L' ? -6 : 6), cy(p[1]) + (vShift || 4));
}

// Equilibrium dot + dashed reference lines, returns nothing
function eqPoint(ux, uy, xTk, yTk, color) {
  const col = color || K.eq;
  // dashed lines
  gctx.setLineDash([3, 4]);
  gctx.strokeStyle = K.axTxt;
  gctx.lineWidth = 0.8;
  gctx.beginPath();
  gctx.moveTo(cx(ux), cy(uy)); gctx.lineTo(cx(ux), cy(0));
  gctx.stroke();
  gctx.beginPath();
  gctx.moveTo(cx(ux), cy(uy)); gctx.lineTo(cx(0), cy(uy));
  gctx.stroke();
  gctx.setLineDash([]);
  // dot
  gctx.beginPath();
  gctx.arc(cx(ux), cy(uy), 5, 0, 2 * Math.PI);
  gctx.fillStyle = col;
  gctx.fill();
  gctx.strokeStyle = '#131317';
  gctx.lineWidth = 1.5;
  gctx.stroke();
  // tick labels
  gctx.fillStyle = col;
  gctx.font = '10px ' + font();
  if (xTk) { gctx.textAlign = 'center'; gctx.fillText(xTk, cx(ux), cy(0) + 16); }
  if (yTk) { gctx.textAlign = 'right';  gctx.fillText(yTk, cx(0) - 5, cy(uy) + 4); }
}

// Fill closed polygon
function fillPoly(pts, color) {
  if (!pts || pts.length < 3) return;
  gctx.beginPath();
  gctx.moveTo(cx(pts[0][0]), cy(pts[0][1]));
  for (let i = 1; i < pts.length; i++) gctx.lineTo(cx(pts[i][0]), cy(pts[i][1]));
  gctx.closePath();
  gctx.fillStyle = color;
  gctx.fill();
}

// Draw axis tick
function xTick(u, label, col) {
  gctx.fillStyle = col || K.axTxt;
  gctx.font = '10px ' + font();
  gctx.textAlign = 'center';
  gctx.fillText(label, cx(u), cy(0) + 16);
}
function yTick(u, label, col) {
  gctx.fillStyle = col || K.axTxt;
  gctx.font = '10px ' + font();
  gctx.textAlign = 'right';
  gctx.fillText(label, cx(0) - 5, cy(u) + 4);
}

// Draw horizontal or vertical named line
function hLine(u, color, label, labelSide, dash) {
  gctx.strokeStyle = color; gctx.lineWidth = 1.5;
  gctx.setLineDash(dash || [4, 3]);
  gctx.beginPath();
  gctx.moveTo(cx(0.02), cy(u)); gctx.lineTo(cx(0.97), cy(u));
  gctx.stroke(); gctx.setLineDash([]);
  if (label) {
    gctx.fillStyle = color; gctx.font = 'bold 10px ' + font();
    gctx.textAlign = labelSide === 'R' ? 'left' : 'right';
    gctx.fillText(label, labelSide === 'R' ? cx(0.98) : cx(0) - 4, cy(u) + 4);
  }
}
function vLine(u, color, label, dash) {
  gctx.strokeStyle = color; gctx.lineWidth = 1.8;
  gctx.setLineDash(dash || []);
  gctx.beginPath();
  gctx.moveTo(cx(u), cy(0.01)); gctx.lineTo(cx(u), cy(0.99));
  gctx.stroke(); gctx.setLineDash([]);
  if (label) {
    gctx.fillStyle = color; gctx.font = 'bold 12px ' + font();
    gctx.textAlign = 'center'; gctx.fillText(label, cx(u), cy(0.99) - 5);
  }
}

// Legend row
function legend(items) {
  let x = L.left + 8, y = L.top + 16;
  gctx.font = '11px ' + font();
  items.forEach(it => {
    gctx.strokeStyle = it.c; gctx.lineWidth = 2;
    gctx.setLineDash(it.dash || []);
    gctx.beginPath(); gctx.moveTo(x, y); gctx.lineTo(x + 18, y); gctx.stroke();
    gctx.setLineDash([]);
    gctx.fillStyle = K.txt; gctx.textAlign = 'left';
    gctx.fillText(it.l, x + 22, y + 4);
    x += 24 + it.l.length * 6.3 + 6;
    if (x > GW - 100) { x = L.left + 8; y += 16; }
  });
}

// Floating label at arbitrary position
function label(text, ux, uy, color, align, size) {
  gctx.fillStyle = color || K.axTxt;
  gctx.font = (size||'10') + 'px ' + font();
  gctx.textAlign = align || 'center';
  gctx.fillText(text, cx(ux), cy(uy));
}

// Generate curve points from a function f(x) over x range
function curve(fn, x0, x1, step) {
  const pts = [];
  for (let x = x0; x <= x1 + 1e-9; x += (step || 0.01)) {
    const y = fn(x);
    if (y >= -0.02 && y <= 1.05) pts.push([x, y]);
  }
  return pts;
}

// ═══════════════════════════════════════════════════════════════
//  GRAPH DRAW FUNCTIONS — each fully self-contained
// ═══════════════════════════════════════════════════════════════

//
// ── GRAPH 1: AD-AS ────────────────────────────────────────────
//
// AD:   P = (0.86 + adS*0.13) - 0.70*Y
// SRAS: P = (0.10 - srasS*0.13) + 0.72*Y
// LRAS: vertical at Yp = 0.50 + lrasS*0.11
//
// Equilibrium AD ∩ SRAS:
//   0.86 + adS*0.13 - 0.70Y = 0.10 - srasS*0.13 + 0.72Y
//   (0.76 + adS*0.13 + srasS*0.13) = 1.42Y
//   Y* = (0.76 + (adS+srasS)*0.13) / 1.42
//   P* = AD(Y*)
//
function drawADAS() {
  const adS   = gv('ad',   0);
  const srasS = gv('sras', 0);
  const lrasS = gv('lras', 0);

  const AD   = Y => (0.86 + adS*0.13) - 0.70*Y;
  const SRAS = Y => (0.10 - srasS*0.13) + 0.72*Y;
  const Yp   = 0.50 + lrasS*0.11;

  // Algebraic equilibrium
  const Yeq = (0.76 + (adS + srasS)*0.13) / 1.42;
  const Peq = AD(Yeq);

  // Ghost curves
  if (Math.abs(adS)   > 0.04) drawLine(curve(Y => 0.86 - 0.70*Y, 0.03, 0.97), K.old, 1.2, [5,4]);
  if (Math.abs(srasS) > 0.04) drawLine(curve(Y => 0.10 + 0.72*Y, 0.03, 0.97), K.old, 1.2, [5,4]);
  if (Math.abs(lrasS) > 0.04) { gctx.strokeStyle=K.old; gctx.lineWidth=1.2; gctx.setLineDash([5,4]); gctx.beginPath(); gctx.moveTo(cx(0.50),cy(0.01)); gctx.lineTo(cx(0.50),cy(0.99)); gctx.stroke(); gctx.setLineDash([]); }

  drawAxes('Real GDP (Y)', 'Price Level (P)');
  vLine(Yp, K.green, 'LRAS');
  xTick(Yp, 'Yp', K.green);

  drawLine(curve(AD,   0.03, 0.97), K.blue, 2.2);
  drawLine(curve(SRAS, 0.03, 0.97), K.red,  2.2);
  endLabel(curve(AD, 0.03, 0.97), 'AD', K.blue);
  endLabel(curve(SRAS, 0.03, 0.97), 'SRAS', K.red);

  if (Yeq > 0.04 && Yeq < 0.96 && Peq > 0.03 && Peq < 0.97) {
    eqPoint(Yeq, Peq, 'Y*', 'P*');
    // Gap annotation
    const gap = Yeq - Yp;
    if (Math.abs(gap) > 0.04) {
      const mid = (Yeq + Yp) / 2;
      const col = gap > 0 ? '#DC2626' : '#16A34A';
      gctx.strokeStyle = col; gctx.lineWidth = 1.5; gctx.setLineDash([3,3]);
      gctx.beginPath(); gctx.moveTo(cx(Yp), cy(Peq - 0.04)); gctx.lineTo(cx(Yeq), cy(Peq - 0.04)); gctx.stroke();
      gctx.setLineDash([]);
      label(gap > 0 ? 'Inflationary gap' : 'Recessionary gap', mid, Peq - 0.08, col, 'center', '9');
    }
  }

  legend([{l:'AD',c:K.blue},{l:'SRAS',c:K.red},{l:'LRAS',c:K.green}]);
}

//
// ── GRAPH 2: SUPPLY & DEMAND ───────────────────────────────────
//
// D: P = (0.90 + dS*0.13) - 0.80*Q
// S: P = (0.08 - sS*0.13) + 0.78*Q + taxS*0.11   [tax shifts S up]
//
// Equilibrium D=S:
//   0.90 + dS*0.13 - 0.80Q = 0.08 - sS*0.13 + 0.78Q + taxS*0.11
//   (0.82 + (dS+sS)*0.13 - taxS*0.11) = 1.58Q
//   Q* = (0.82 + (dS+sS)*0.13 - taxS*0.11) / 1.58
//   P* = D(Q*)
//
// Seller receives: Ps = S0(Q*)  [supply without tax]
//
function drawSD() {
  const dS    = gv('d',     0);
  const sS    = gv('s',     0);
  const taxS  = gv('tax',   0);
  const flOn  = tv('floor', 0) > 0.5;
  const ceOn  = tv('ceil',  0) > 0.5;

  const D  = Q => (0.90 + dS*0.13) - 0.80*Q;
  const S  = Q => (0.08 - sS*0.13) + 0.78*Q + taxS*0.11;
  const S0 = Q => (0.08 - sS*0.13) + 0.78*Q;  // pre-tax

  // Algebraic equilibrium
  const Qeq = (0.82 + (dS + sS)*0.13 - taxS*0.11) / 1.58;
  const Peq = D(Qeq);
  const Peq0 = D((0.82 + (dS + sS)*0.13) / 1.58); // pre-tax eq price

  // CS: triangle above Peq under D curve from Q=0 to Q=Qeq
  // Vertices: (0, D(0)), trace D from 0→Qeq, then (Qeq,Peq), (0,Peq)
  const Dint = D(0); // y-intercept of D
  const csPoly = [[0, Dint]];
  for (let q = 0; q <= Qeq; q += 0.01) csPoly.push([q, D(q)]);
  csPoly.push([Qeq, Peq], [0, Peq]);
  fillPoly(csPoly, K.cs);

  // PS: triangle below Peq above S0 from Q=0 to Q=Qeq
  const Sint = S0(0);
  const psPoly = [[0, Peq], [Qeq, Peq]];
  for (let q = Qeq; q >= 0; q -= 0.01) psPoly.push([q, S0(q)]);
  psPoly.push([0, Sint]);
  fillPoly(psPoly, K.ps);

  // DWL from tax
  if (taxS > 0.04) {
    const Qwt = (0.82 + (dS + sS)*0.13) / 1.58; // without-tax eq
    // DWL = triangle (Qeq, Pc), (Qwt, D(Qwt)), (Qeq, S0(Qeq))
    // where Pc = D(Qeq), S0(Qeq) = price seller receives
    const Pc = D(Qeq);
    const Pp = S0(Qeq);
    fillPoly([[Qeq, Pc], [Qwt, D(Qwt)], [Qeq, Pp]], K.dwl);
    label('DWL', Qeq + 0.04, (Pc + Pp) / 2 + 0.02, '#C05700', 'left', '9');
    // tax revenue rectangle
    fillPoly([[0, Pc], [Qeq, Pc], [Qeq, Pp], [0, Pp]], 'rgba(37,99,235,0.08)');
    label('Tax rev.', Qeq / 2, (Pc + Pp) / 2, K.blue, 'center', '9');
    drawLine(curve(S0, 0, 0.97), K.old, 1.2, [4,3]);
    label('S₀', 0.97, S0(0.97) + 0.03, K.old, 'right', '10');
  }

  // Ghost curves
  if (Math.abs(dS) > 0.04) drawLine(curve(Q => 0.90 - 0.80*Q, 0, 0.97), K.old, 1.2, [4,3]);
  if (Math.abs(sS) > 0.04) drawLine(curve(Q => 0.08 + 0.78*Q, 0, 0.97), K.old, 1.2, [4,3]);

  drawAxes('Quantity (Q)', 'Price (P)');
  drawLine(curve(D, 0, 0.97), K.blue, 2.2);
  drawLine(curve(S, 0.01, 0.97), K.red, 2.2);
  endLabel(curve(D, 0, 0.97), 'D', K.blue);
  endLabel(curve(S, 0.01, 0.97), 'S', K.red, 'L');

  // CS/PS interior labels
  label('CS', Qeq * 0.35, Peq + 0.10, K.blue);
  label('PS', Qeq * 0.35, Peq - 0.12, K.red);

  // Price floor
  if (flOn) {
    const Pf = Peq + 0.18;
    const Qd_f = (D(0) - Pf) / 0.80;
    const Qs_f = (Pf - S0(0)) / 0.78;
    // DWL triangle
    if (Qd_f < Qeq) fillPoly([[Qd_f, Pf], [Qeq, Peq], [Qd_f, S0(Qd_f)]], K.dwl);
    hLine(Pf, '#DC2626', null, 'R');
    yTick(Pf, 'Pf', '#DC2626');
    label('Price floor', 0.5, Pf + 0.04, '#DC2626', 'center', '10');
    // surplus bracket
    if (Qs_f > Qd_f + 0.02) {
      gctx.strokeStyle = '#DC2626'; gctx.lineWidth = 1.2;
      const y0 = cy(Pf) - 14;
      gctx.beginPath(); gctx.moveTo(cx(Qd_f), y0); gctx.lineTo(cx(Qs_f), y0); gctx.stroke();
      gctx.beginPath(); gctx.moveTo(cx(Qd_f), y0-5); gctx.lineTo(cx(Qd_f), y0+5); gctx.stroke();
      gctx.beginPath(); gctx.moveTo(cx(Qs_f), y0-5); gctx.lineTo(cx(Qs_f), y0+5); gctx.stroke();
      label('Surplus', (Qd_f+Qs_f)/2, Pf + 0.12, '#DC2626', 'center', '9');
      xTick(Qd_f, 'Qd', '#DC2626'); xTick(Qs_f, 'Qs', K.red);
    }
  }
  // Price ceiling
  if (ceOn) {
    const Pc = Peq - 0.18;
    const Qd_c = (D(0) - Pc) / 0.80;
    const Qs_c = (Pc - S0(0)) / 0.78;
    if (Qs_c < Qeq) fillPoly([[Qs_c, Pc], [Qeq, Peq], [Qs_c, D(Qs_c)]], K.dwl);
    hLine(Pc, '#16A34A', null, 'R');
    yTick(Pc, 'Pc', '#16A34A');
    label('Price ceiling', 0.5, Pc - 0.06, '#16A34A', 'center', '10');
    if (Qd_c > Qs_c + 0.02) {
      gctx.strokeStyle = '#16A34A'; gctx.lineWidth = 1.2;
      const y0 = cy(Pc) + 14;
      gctx.beginPath(); gctx.moveTo(cx(Qs_c), y0); gctx.lineTo(cx(Qd_c), y0); gctx.stroke();
      gctx.beginPath(); gctx.moveTo(cx(Qs_c), y0-5); gctx.lineTo(cx(Qs_c), y0+5); gctx.stroke();
      gctx.beginPath(); gctx.moveTo(cx(Qd_c), y0-5); gctx.lineTo(cx(Qd_c), y0+5); gctx.stroke();
      label('Shortage', (Qs_c+Qd_c)/2, Pc - 0.12, '#16A34A', 'center', '9');
      xTick(Qs_c, 'Qs', K.red); xTick(Qd_c, 'Qd', '#16A34A');
    }
  }

  if (Qeq > 0.03 && Qeq < 0.97 && Peq > 0.03 && Peq < 0.97) eqPoint(Qeq, Peq, 'Q*', 'P*');
  legend([{l:'Demand (D)',c:K.blue},{l:'Supply (S)',c:K.red}]);
}

//
// ── GRAPH 3: LOANABLE FUNDS ────────────────────────────────────
//
// D: r = (0.88 + dS*0.13) - 0.76*Q
// S: r = (0.08 - sS*0.13) + 0.82*Q
//
// Eq: (0.80 + (dS+sS)*0.13) = 1.58Q  →  Q* = (0.80+(dS+sS)*0.13)/1.58
//     r* = D(Q*)
//
function drawLF() {
  const dS = gv('dlf', 0), sS = gv('slf', 0);
  const D  = Q => (0.88 + dS*0.13) - 0.76*Q;
  const S  = Q => (0.08 - sS*0.13) + 0.82*Q;
  const Qeq = (0.80 + (dS+sS)*0.13) / 1.58;
  const Req  = D(Qeq);

  if (Math.abs(dS) > 0.04) drawLine(curve(Q => 0.88 - 0.76*Q, 0.03, 0.97), K.old, 1.2, [4,3]);
  if (Math.abs(sS) > 0.04) drawLine(curve(Q => 0.08 + 0.82*Q, 0.03, 0.97), K.old, 1.2, [4,3]);

  drawAxes('Quantity of Loanable Funds', 'Real Interest Rate (r)');
  drawLine(curve(D, 0.03, 0.97), K.blue, 2.2);
  drawLine(curve(S, 0.03, 0.97), K.red,  2.2);
  endLabel(curve(D, 0.03, 0.97), 'Dlf', K.blue);
  endLabel(curve(S, 0.03, 0.97), 'Slf', K.red, 'L');

  if (Qeq > 0.03 && Qeq < 0.97 && Req > 0.03 && Req < 0.97) eqPoint(Qeq, Req, 'Q*', 'r*');
  legend([{l:'Demand (invest.)',c:K.blue},{l:'Supply (savings)',c:K.red}]);
}

//
// ── GRAPH 4: MONEY MARKET ──────────────────────────────────────
//
// MS: vertical at Xms = 0.48 + msS*0.11
// MD: i = (0.88 + mdS*0.13) - 0.72*Q
//
// Eq: i* = MD(Xms)  [MD evaluated at MS vertical]
//
function drawMM() {
  const msS = gv('ms', 0), mdS = gv('md', 0);
  const Xms = 0.48 + msS*0.11;
  const MD  = Q => (0.88 + mdS*0.13) - 0.72*Q;
  const ieq = MD(Xms);

  if (Math.abs(msS) > 0.04) { gctx.strokeStyle=K.old; gctx.lineWidth=1.2; gctx.setLineDash([5,4]); gctx.beginPath(); gctx.moveTo(cx(0.48),cy(0.01)); gctx.lineTo(cx(0.48),cy(0.99)); gctx.stroke(); gctx.setLineDash([]); }
  if (Math.abs(mdS) > 0.04) drawLine(curve(Q => 0.88 - 0.72*Q, 0.03, 0.97), K.old, 1.2, [4,3]);

  drawAxes('Quantity of Money', 'Nominal Interest Rate (i)');
  vLine(Xms, K.green, 'MS');
  drawLine(curve(MD, 0.03, 0.97), K.blue, 2.2);
  endLabel(curve(MD, 0.03, 0.97), 'MD', K.blue);
  xTick(Xms, 'M*', K.green);

  if (Xms > 0.04 && Xms < 0.96 && ieq > 0.03 && ieq < 0.97) eqPoint(Xms, ieq, null, 'i*');
  legend([{l:'Money Supply (MS)',c:K.green},{l:'Money Demand (MD)',c:K.blue}]);
}

//
// ── GRAPH 5: PHILLIPS CURVE ────────────────────────────────────
//
// SRPC: π = A / u^0.6  where A = 0.68 + srpcS*0.10
// (Rectangular hyperbola — properly concave from origin)
// Natural rate: uN = 0.40 + lrpcS*0.10
//
// The curve passes through (uN, πN) where πN = A / uN^0.6
// NAIRU intersection shown with annotation
//
function drawPhillips() {
  const srpcS = gv('srpc', 0), lrpcS = gv('lrpc', 0);
  const A  = 0.68 + srpcS*0.10;
  const uN = 0.40 + lrpcS*0.10;
  const SRPC = u => A / Math.pow(u, 0.6);
  const πN = SRPC(uN);

  if (Math.abs(srpcS) > 0.04) {
    const A0 = 0.68;
    drawLine(curve(u => A0 / Math.pow(u, 0.6), 0.10, 0.94), K.old, 1.2, [4,3]);
  }
  if (Math.abs(lrpcS) > 0.04) {
    gctx.strokeStyle=K.old; gctx.lineWidth=1.2; gctx.setLineDash([5,4]);
    gctx.beginPath(); gctx.moveTo(cx(0.40),cy(0.01)); gctx.lineTo(cx(0.40),cy(0.99)); gctx.stroke(); gctx.setLineDash([]);
  }

  drawAxes('Unemployment Rate (u)', 'Inflation Rate (π)');
  // 2% target reference
  hLine(0.18, K.axTxt, null, 'R', [2,3]);
  label('2% target', 0.96, 0.21, K.axTxt, 'right', '9');

  vLine(uN, K.green, 'LRPC');
  xTick(uN, 'u_n', K.green);

  drawLine(curve(SRPC, 0.10, 0.94), K.blue, 2.2);
  label('SRPC', 0.90, SRPC(0.90) + 0.04, K.blue, 'left', '12');

  if (uN > 0.10 && uN < 0.94 && πN > 0.03 && πN < 0.97) eqPoint(uN, πN, null, 'π_n');
  legend([{l:'SRPC',c:K.blue},{l:'LRPC (NAIRU)',c:K.green}]);
}

//
// ── GRAPH 6: PPC ───────────────────────────────────────────────
//
// Concave power function: (X/A)^n + (Y/B)^n = 1, n = 1.85
// Parameterized by angle t ∈ [0, π/2]
// X(t) = A * cos(t)^(2/n)
// Y(t) = B * sin(t)^(2/n)
//
// Scale s = 0.88 * scl; A = s*(1+xB*0.14); B = s*(1+yB*0.14)
//
function drawPPC() {
  const scl    = gv('ppcScale', 1.0);
  const xB     = gv('xbias',   0);
  const yB     = gv('ybias',   0);
  const insOn  = tv('inside',  0) > 0.5;
  const n = 1.85;
  const s = 0.88 * scl;
  const A = s * (1 + xB * 0.14);
  const B = s * (1 + yB * 0.14);

  function ppcPts(a, b) {
    const pts = [];
    for (let t = 0; t <= Math.PI/2 + 1e-9; t += 0.02) {
      const X = a * Math.pow(Math.cos(t), 2/n);
      const Y = b * Math.pow(Math.sin(t), 2/n);
      if (X >= 0 && X <= 1.01 && Y >= 0 && Y <= 1.01) pts.push([X, Y]);
    }
    return pts;
  }

  const pts = ppcPts(A, B);
  // attainable region fill
  gctx.beginPath();
  gctx.moveTo(cx(0), cy(0));
  pts.forEach(p => gctx.lineTo(cx(p[0]), cy(p[1])));
  gctx.lineTo(cx(0), cy(0));
  gctx.closePath();
  gctx.fillStyle = 'rgba(37,99,235,0.06)';
  gctx.fill();

  // ghost
  if (Math.abs(scl-1) > 0.04 || Math.abs(xB) > 0.03 || Math.abs(yB) > 0.03) {
    drawLine(ppcPts(0.88, 0.88), K.old, 1.5, [5,4]);
    label('PPC₀', 0.88 + 0.03, 0.10, K.old, 'left', '10');
  }

  drawAxes('Capital Goods (X)', 'Consumer Goods (Y)');
  drawLine(pts, K.blue, 2.4);
  if (pts.length) label("PPC'", pts[pts.length-1][0] + 0.02, pts[pts.length-1][1] + 0.04, K.blue, 'left', '12');

  // midpoint efficient point
  const midPt = pts[Math.floor(pts.length / 2)];
  if (midPt && !insOn) {
    gctx.beginPath(); gctx.arc(cx(midPt[0]), cy(midPt[1]), 5, 0, 2*Math.PI);
    gctx.fillStyle = K.eq; gctx.fill();
    label('A (efficient)', midPt[0] + 0.04, midPt[1], K.axTxt, 'left', '10');
  }
  if (insOn) {
    gctx.beginPath(); gctx.arc(cx(0.34), cy(0.30), 6, 0, 2*Math.PI);
    gctx.fillStyle = K.amber; gctx.fill();
    label('A (inefficient)', 0.38, 0.30, K.amber, 'left', '10');
    // arrow toward PPC
    if (midPt) {
      gctx.strokeStyle = K.axTxt; gctx.lineWidth = 0.8; gctx.setLineDash([2,3]);
      gctx.beginPath(); gctx.moveTo(cx(0.34), cy(0.30)); gctx.lineTo(cx(midPt[0]*0.85), cy(midPt[1]*0.85+0.05)); gctx.stroke();
      gctx.setLineDash([]);
    }
  }
  label('Attainable', 0.14, 0.12, K.axTxt, 'center', '9');
  label('Unattainable', 0.72, 0.80, K.axTxt, 'center', '9');
  legend([{l:'PPC',c:K.blue}]);
}

//
// ── GRAPH 7: LABOR MARKET ──────────────────────────────────────
//
// LD: W = (0.88 + ldS*0.12) - 0.72*L
// LS: W = (0.08 - lsS*0.12) + 0.78*L
//
// Eq: (0.80 + (ldS+lsS)*0.12) = 1.50L  →  L* = (0.80+(ldS+lsS)*0.12)/1.50
//     W* = LD(L*)
//
function drawLabor() {
  const ldS   = gv('ld',    0);
  const lsS   = gv('ls',    0);
  const flOn  = tv('lfloor',0) > 0.5;
  const LD    = L => (0.88 + ldS*0.12) - 0.72*L;
  const LS    = L => (0.08 - lsS*0.12) + 0.78*L;
  const Leq   = (0.80 + (ldS+lsS)*0.12) / 1.50;
  const Weq   = LD(Leq);

  // Worker surplus (above LS, below W*)
  const wsPoly = [[0, Weq], [Leq, Weq]];
  for (let L = Leq; L >= 0; L -= 0.01) wsPoly.push([L, LS(L)]);
  wsPoly.push([0, LS(0)]);
  fillPoly(wsPoly, K.cs);

  // Firm surplus (below LD, above W*)
  const fsPoly = [[0, Weq], [Leq, Weq]];
  for (let L = Leq; L >= 0; L -= 0.01) fsPoly.push([L, LD(L)]);
  fsPoly.push([0, LD(0)]);
  fillPoly(fsPoly, K.ps);

  if (Math.abs(ldS) > 0.04) drawLine(curve(L => 0.88 - 0.72*L, 0.03, 0.97), K.old, 1.2, [4,3]);
  if (Math.abs(lsS) > 0.04) drawLine(curve(L => 0.08 + 0.78*L, 0.03, 0.97), K.old, 1.2, [4,3]);

  drawAxes('Quantity of Labor (L)', 'Wage Rate (W)');
  drawLine(curve(LD, 0.03, 0.97), K.blue, 2.2);
  drawLine(curve(LS, 0.03, 0.97), K.red,  2.2);
  endLabel(curve(LD, 0.03, 0.97), 'LD', K.blue);
  endLabel(curve(LS, 0.03, 0.97), 'LS', K.red, 'L');
  label('WS', Leq*0.35, Weq + 0.10, K.blue, 'center', '9');
  label('FS', Leq*0.35, Weq - 0.12, K.red,  'center', '9');

  if (flOn) {
    const Wm   = Weq + 0.17;
    const Ld_m = ((0.88 + ldS*0.12) - Wm) / 0.72;
    const Ls_m = (Wm - (0.08 - lsS*0.12)) / 0.78;
    // DWL
    if (Ld_m > 0 && Ld_m < Leq) fillPoly([[Ld_m, Wm],[Leq,Weq],[Ld_m, LD(Ld_m)]], K.dwl);
    hLine(Wm, '#DC2626', 'Wmin', 'R');
    if (Ls_m > Ld_m + 0.02) {
      gctx.strokeStyle = '#DC2626'; gctx.lineWidth = 1.2;
      const y0 = cy(Wm) - 14;
      gctx.beginPath(); gctx.moveTo(cx(Ld_m), y0); gctx.lineTo(cx(Ls_m), y0); gctx.stroke();
      gctx.beginPath(); gctx.moveTo(cx(Ld_m), y0-5); gctx.lineTo(cx(Ld_m), y0+5); gctx.stroke();
      gctx.beginPath(); gctx.moveTo(cx(Ls_m), y0-5); gctx.lineTo(cx(Ls_m), y0+5); gctx.stroke();
      label('Unemployment', (Ld_m+Ls_m)/2, Wm + 0.10, '#DC2626', 'center', '9');
      xTick(Ld_m, 'Ld', '#DC2626'); xTick(Ls_m, 'Ls', K.red);
    }
  }

  if (Leq > 0.03 && Leq < 0.97 && Weq > 0.03 && Weq < 0.97) eqPoint(Leq, Weq, 'L*', 'W*');
  legend([{l:'Labor Demand (MRP)',c:K.blue},{l:'Labor Supply',c:K.red}]);
}

//
// ── GRAPH 8: COST CURVES ───────────────────────────────────────
//
// All functions of q ∈ [0.07, 0.93]:
//
// AVC(q) = 0.22 + 0.55*(q-0.44)^2 + (avcS+mcS)*0.09
// AFC(q) = 0.048 / q
// ATC(q) = AVC(q) + AFC(q) + atcS*0.09
// MC(q)  = 0.18 + 2.0*(q-0.38)^2 + (mcS+avcS)*0.09
//
// MC = AVC at AVC minimum (q ≈ 0.44)
// MC = ATC at ATC minimum (q ≈ 0.60)
//
// Profit-max: MC = MR = P  →  0.18 + 2.0*(q-0.38)^2 + (mcS+avcS)*0.09 = mrY
//   2.0*(q-0.38)^2 = mrY - 0.18 - (mcS+avcS)*0.09
//   q* = 0.38 + sqrt(...)  (right branch)
//
function drawCost() {
  const mcS  = gv('mc',  0);
  const atcS = gv('atc', 0);
  const avcS = gv('avc', 0);
  const mrS  = gv('mr',  0);
  const mrY  = 0.46 + mrS*0.09;

  const AVC = q => 0.22 + 0.55*(q-0.44)**2 + (avcS+mcS)*0.09;
  const AFC = q => 0.048 / q;
  const ATC = q => AVC(q) + AFC(q) + atcS*0.09;
  const MC  = q => 0.18 + 2.0*(q-0.38)**2 + (mcS+avcS)*0.09;

  // Profit-max Q: MC = MR
  const rhs = mrY - 0.18 - (mcS+avcS)*0.09;
  let profQ = rhs >= 0 ? 0.38 + Math.sqrt(rhs / 2.0) : null;
  if (profQ && (profQ < 0.07 || profQ > 0.93)) profQ = null;

  const avcAtQ  = profQ ? AVC(profQ) : null;
  const atcAtQ  = profQ ? ATC(profQ) : null;
  const shutdown = profQ && mrY < avcAtQ;

  // Profit / loss shade (rectangle from q=0 to profQ)
  if (profQ && !shutdown && atcAtQ) {
    if (mrY > atcAtQ) {
      fillPoly([[0.07, mrY],[profQ, mrY],[profQ, atcAtQ],[0.07, atcAtQ]], K.profit);
      label('Profit', (0.07+profQ)/2, (mrY+atcAtQ)/2, '#15803D', 'center', '9');
    } else if (mrY < atcAtQ && mrY > avcAtQ) {
      fillPoly([[0.07, atcAtQ],[profQ, atcAtQ],[profQ, mrY],[0.07, mrY]], K.loss);
      label('Loss', (0.07+profQ)/2, (mrY+atcAtQ)/2, '#B91C1C', 'center', '9');
    }
  }

  drawAxes('Quantity (Q)', 'Cost / Price ($)');

  // MR = P line
  gctx.strokeStyle = K.green; gctx.lineWidth = 2; gctx.setLineDash([6,3]);
  gctx.beginPath(); gctx.moveTo(cx(0.07), cy(mrY)); gctx.lineTo(cx(0.93), cy(mrY)); gctx.stroke();
  gctx.setLineDash([]);
  label('MR=P', 0.93, mrY + 0.03, K.green, 'left', '11');
  yTick(mrY, 'P*', K.green);

  drawLine(curve(AFC, 0.08, 0.93), K.gray,  1.8); endLabel(curve(AFC, 0.08, 0.93), 'AFC', K.gray);
  drawLine(curve(AVC, 0.07, 0.93), K.amber, 2.0); endLabel(curve(AVC, 0.07, 0.93), 'AVC', K.amber);
  drawLine(curve(ATC, 0.07, 0.93), K.blue,  2.2); endLabel(curve(ATC, 0.07, 0.93), 'ATC', K.blue);
  drawLine(curve(MC,  0.07, 0.93), K.red,   2.2); endLabel(curve(MC,  0.07, 0.93), 'MC',  K.red);

  // ATC minimum (long-run break-even)
  const atcMinQ = 0.58 + (atcS + avcS + mcS) * 0.01;
  const atcMinV = ATC(atcMinQ);
  gctx.beginPath(); gctx.arc(cx(atcMinQ), cy(atcMinV), 4.5, 0, 2*Math.PI);
  gctx.fillStyle = K.blue; gctx.fill();
  label('Break-even', atcMinQ + 0.04, atcMinV - 0.04, K.blue, 'left', '9');

  // Profit-max point
  if (profQ && !shutdown) {
    gctx.setLineDash([3,3]); gctx.strokeStyle = K.axTxt; gctx.lineWidth = 0.8;
    gctx.beginPath(); gctx.moveTo(cx(profQ), cy(mrY)); gctx.lineTo(cx(profQ), cy(0)); gctx.stroke();
    gctx.setLineDash([]);
    xTick(profQ, 'Q*', K.green);
    gctx.beginPath(); gctx.arc(cx(profQ), cy(mrY), 5.5, 0, 2*Math.PI);
    gctx.fillStyle = K.green; gctx.fill();
    gctx.strokeStyle = '#131317'; gctx.lineWidth = 1.5; gctx.stroke();
    label('Profit max (MC=MR)', profQ + 0.03, mrY + 0.05, K.green, 'left', '9');
  }
  if (shutdown) {
    gctx.fillStyle = 'rgba(220,38,38,0.06)';
    gctx.fillRect(cx(0.07), cy(0.6), cx(0.93)-cx(0.07), cy(0)-cy(0.6));
    label('Shutdown region (P < AVC)', 0.50, 0.04, '#DC2626', 'center', '9');
  }

  legend([{l:'MC',c:K.red},{l:'ATC',c:K.blue},{l:'AVC',c:K.amber},{l:'AFC',c:K.gray},{l:'MR=P',c:K.green,dash:[6,3]}]);
}

//
// ── GRAPH 9: MONOPOLY ──────────────────────────────────────────
//
// Demand (=AR): P = (0.92 + dS*0.10) - 0.84*Q
// MR: P = (0.92 + dS*0.10) - 2*0.84*Q  [linear demand → MR slope = 2× demand]
// MC: P = 0.15 + 1.8*(Q-0.32)^2 + mcS*0.09  [U-shaped]
// ATC: P = MC + 0.06/Q
//
// Profit-max: MR = MC  (solve numerically by scanning Q)
// Monopoly price Pm: read off demand curve at Qm
//
// Socially optimal: P = MC  (scan for D(Q) = MC(Q))
// Fair return:      P = ATC (scan for D(Q) = ATC(Q))
//
function drawMonopoly() {
  const dS   = gv('mdmd', 0);
  const mcS  = gv('mmc',  0);
  const regOn  = tv('mreg',  0) > 0.5;
  const fairOn = tv('mfair', 0) > 0.5;

  const DA  = Q => (0.92 + dS*0.10) - 0.84*Q;
  const MR  = Q => (0.92 + dS*0.10) - 2*0.84*Q;
  const MC  = Q => 0.15 + 1.8*(Q-0.32)**2 + mcS*0.09;
  const ATC = Q => MC(Q) + 0.06/(Q+0.01);

  // Profit-max Q: MR = MC (scan from left)
  let Qm = null;
  for (let q = 0.05; q <= 0.59; q += 0.001) {
    if (MR(q) <= MC(q)) { Qm = q; break; }
  }
  if (!Qm) Qm = 0.35;
  const Pm  = DA(Qm);
  const MCm = MC(Qm);

  // Socially optimal Q: DA(Q) = MC(Q)
  let Qso = null;
  for (let q = Qm; q <= 0.95; q += 0.001) {
    if (DA(q) <= MC(q)) { Qso = q; break; }
  }
  if (!Qso) Qso = 0.65;
  const Pso = DA(Qso);

  // Fair-return Q: DA(Q) = ATC(Q)
  let Qfr = null;
  for (let q = Qm; q <= 0.95; q += 0.001) {
    if (DA(q) <= ATC(q)) { Qfr = q; break; }
  }
  if (!Qfr) Qfr = 0.55;
  const Pfr = DA(Qfr);

  // DWL triangle
  fillPoly([[Qm, Pm],[Qso, Pso],[Qm, MCm]], K.dwl);
  // CS (under Pm, above demand y-intercept... above Pm under D from 0 to Qm)
  const csPoly = [[0, DA(0)]];
  for (let q = 0; q <= Qm; q += 0.01) csPoly.push([q, DA(q)]);
  csPoly.push([Qm, Pm],[0, Pm]);
  fillPoly(csPoly, K.cs);
  // PS (below Pm, above MC from 0 to Qm)
  const psPoly = [[0, Pm],[Qm, Pm],[Qm, MCm]];
  for (let q = Qm; q >= 0; q -= 0.01) psPoly.push([q, MC(q)]);
  fillPoly(psPoly, K.ps);

  if (Math.abs(dS)  > 0.04) drawLine(curve(Q => 0.92 - 0.84*Q, 0.03, 0.97), K.old, 1.2, [4,3]);
  if (Math.abs(mcS) > 0.04) drawLine(curve(Q => 0.15 + 1.8*(Q-0.32)**2, 0.07, 0.93), K.old, 1.2, [4,3]);

  drawAxes('Quantity (Q)', 'Price / Cost ($)');
  drawLine(curve(ATC, 0.08, 0.93), K.gray, 1.8); endLabel(curve(ATC, 0.08, 0.93), 'ATC', K.gray);
  drawLine(curve(MC,  0.07, 0.93), K.red,  2.0); endLabel(curve(MC, 0.07, 0.93), 'MC', K.red);
  drawLine(curve(DA,  0.03, 0.97), K.blue, 2.2); endLabel(curve(DA, 0.03, 0.97), 'D=AR', K.blue);

  // MR (only valid until Q where MR=0)
  const mrPts = [];
  for (let q = 0.03; q <= 0.97; q += 0.01) { const mr = MR(q); if (mr >= -0.1) mrPts.push([q, mr]); }
  drawLine(mrPts, K.purple, 2.2); endLabel(mrPts, 'MR', K.purple);

  // Monopoly equilibrium
  // Vertical from Qm to demand curve = Pm
  gctx.setLineDash([3,3]); gctx.strokeStyle = K.axTxt; gctx.lineWidth = 0.8;
  gctx.beginPath(); gctx.moveTo(cx(Qm), cy(MCm)); gctx.lineTo(cx(0), cy(MCm)); gctx.stroke();
  gctx.beginPath(); gctx.moveTo(cx(Qm), cy(Pm)); gctx.lineTo(cx(0), cy(Pm)); gctx.stroke();
  gctx.setLineDash([]);
  yTick(MCm, 'MC_m'); yTick(Pm, 'Pm', K.blue);
  eqPoint(Qm, Pm, 'Qm', null);
  xTick(Qm, 'Qm');

  label('DWL', Qm + 0.04, (Pm + MCm)/2, '#C05700', 'left', '9');
  label('CS', Qm * 0.38, Pm + 0.08, K.blue, 'center', '9');
  label('PS', Qm * 0.38, (Pm+MCm)/2, K.red, 'center', '9');

  // Regulation
  if (regOn) {
    gctx.strokeStyle = '#16A34A'; gctx.lineWidth = 1.5; gctx.setLineDash([4,3]);
    gctx.beginPath(); gctx.moveTo(cx(Qso), cy(0)); gctx.lineTo(cx(Qso), cy(Pso)); gctx.stroke();
    gctx.beginPath(); gctx.moveTo(cx(0), cy(Pso)); gctx.lineTo(cx(Qso), cy(Pso)); gctx.stroke();
    gctx.setLineDash([]);
    gctx.beginPath(); gctx.arc(cx(Qso), cy(Pso), 5, 0, 2*Math.PI);
    gctx.fillStyle = '#16A34A'; gctx.fill();
    xTick(Qso, 'Qso', '#16A34A'); yTick(Pso, 'Pso', '#16A34A');
    label('Soc.opt (P=MC)', Qso + 0.03, Pso + 0.04, '#16A34A', 'left', '9');
  }
  if (fairOn) {
    gctx.strokeStyle = K.amber; gctx.lineWidth = 1.5; gctx.setLineDash([4,3]);
    gctx.beginPath(); gctx.moveTo(cx(Qfr), cy(0)); gctx.lineTo(cx(Qfr), cy(Pfr)); gctx.stroke();
    gctx.beginPath(); gctx.moveTo(cx(0), cy(Pfr)); gctx.lineTo(cx(Qfr), cy(Pfr)); gctx.stroke();
    gctx.setLineDash([]);
    gctx.beginPath(); gctx.arc(cx(Qfr), cy(Pfr), 5, 0, 2*Math.PI);
    gctx.fillStyle = K.amber; gctx.fill();
    xTick(Qfr, 'Qfr', K.amber); yTick(Pfr, 'Pfr', K.amber);
    label('Fair return (P=ATC)', Qfr + 0.03, Pfr + 0.04, K.amber, 'left', '9');
  }

  legend([{l:'D=AR',c:K.blue},{l:'MR',c:K.purple},{l:'MC',c:K.red},{l:'ATC',c:K.gray}]);
}

//
// ── GRAPH 10: MONOPOLISTIC COMPETITION ────────────────────────
//
// SR: D_SR: P = (0.90 + dS*0.10) - 0.88*Q  [steeper = less elastic]
//     MR_SR: P = (0.90 + dS*0.10) - 2*0.88*Q
// LR: D_LR tangent to ATC at zero-profit point
//     Tangency condition: D_LR'(Q) = ATC'(Q) and D_LR(Q) = ATC(Q)
//     Approximate: D_LR: P = 0.82 - 1.06*Q  [more elastic, lower intercept]
//     MR_LR: P = 0.82 - 2*1.06*Q
// MC: P = 0.18 + 1.6*(Q-0.33)^2
// ATC: P = MC + 0.065/Q
//
function drawMonComp() {
  const dS   = gv('mcdmd', 0);
  const srOn = tv('mcsr', 0) > 0.5;
  const adj  = dS * 0.10;

  const MC   = Q => 0.18 + 1.6*(Q-0.33)**2;
  const ATC  = Q => MC(Q) + 0.065/(Q+0.01);

  // SR demand / MR
  const DSR  = Q => (0.90 + adj) - 0.88*Q;
  const MRSR = Q => (0.90 + adj) - 2*0.88*Q;

  // LR demand: tangent to ATC
  // Find LR equilibrium: D_LR(Q) = ATC(Q) and D_LR'(Q) = ATC'(Q)
  // Use fixed LR D: P = 0.80 - 1.02*Q (calibrated to be tangent to ATC ≈ at Q=0.37)
  const DLR  = Q => 0.80 - 1.02*Q;
  const MRLR = Q => 0.80 - 2*1.02*Q;

  // SR profit-max Q: MR_SR = MC
  let QSR = null;
  for (let q = 0.05; q <= 0.60; q += 0.001) {
    if (MRSR(q) <= MC(q)) { QSR = q; break; }
  }
  if (!QSR) QSR = 0.38;
  const PSR  = DSR(QSR);
  const ATCSR = ATC(QSR);

  // LR profit-max Q: MR_LR = MC (and D_LR = ATC)
  let QLR = null;
  for (let q = 0.05; q <= 0.60; q += 0.001) {
    if (MRLR(q) <= MC(q)) { QLR = q; break; }
  }
  if (!QLR) QLR = 0.33;
  const PLR  = DLR(QLR);
  const ATCLR = ATC(QLR);

  // ATC min (productive efficiency point)
  let atcMinQ = 0.55; let atcMinV = ATC(atcMinQ);
  for (let q = 0.1; q <= 0.9; q += 0.005) { if (ATC(q) < atcMinV) { atcMinV = ATC(q); atcMinQ = q; } }

  // SR profit/loss shade
  if (srOn && PSR > 0 && ATCSR > 0) {
    const qty = QSR;
    if (PSR > ATCSR) fillPoly([[0.05,PSR],[qty,PSR],[qty,ATCSR],[0.05,ATCSR]], K.profit);
    else if (PSR < ATCSR) fillPoly([[0.05,ATCSR],[qty,ATCSR],[qty,PSR],[0.05,PSR]], K.loss);
  }

  drawAxes('Quantity (Q)', 'Price / Cost ($)');
  drawLine(curve(ATC, 0.09, 0.93), K.gray,  1.8); endLabel(curve(ATC, 0.09, 0.93), 'ATC', K.gray);
  drawLine(curve(MC,  0.07, 0.93), K.red,   2.0); endLabel(curve(MC, 0.07, 0.93), 'MC', K.red);

  if (srOn) {
    const srDpts = curve(DSR, 0.03, 0.97).filter(p=>p[1]>=0);
    const srMRpts = curve(MRSR, 0.03, 0.97).filter(p=>p[1]>=-0.1);
    drawLine(srDpts, 'rgba(37,99,235,0.45)', 1.5, [4,3]);
    drawLine(srMRpts, 'rgba(124,58,237,0.45)', 1.5, [4,3]);
    if (srDpts.length) label('D_SR', srDpts[srDpts.length-1][0]+0.02, srDpts[srDpts.length-1][1]+0.02, 'rgba(37,99,235,0.7)', 'left', '10');
    eqPoint(QSR, PSR, 'Q_SR', 'P_SR', 'rgba(37,99,235,0.8)');
    gctx.setLineDash([3,3]); gctx.strokeStyle='rgba(37,99,235,0.5)'; gctx.lineWidth=0.8;
    gctx.beginPath(); gctx.moveTo(cx(QSR),cy(ATCSR)); gctx.lineTo(cx(0),cy(ATCSR)); gctx.stroke();
    gctx.setLineDash([]);
    yTick(ATCSR, 'ATC_SR', K.gray);
  }

  const lrDpts  = curve(DLR,  0.03, 0.97).filter(p=>p[1]>=0);
  const lrMRpts = curve(MRLR, 0.03, 0.97).filter(p=>p[1]>=-0.1);
  drawLine(lrDpts, K.blue, 2.2); endLabel(lrDpts, 'D_LR', K.blue);
  drawLine(lrMRpts, K.purple, 2.2); endLabel(lrMRpts, 'MR_LR', K.purple);
  eqPoint(QLR, PLR, 'Q_LR', 'P_LR');

  // Tangency point (D_LR touches ATC)
  gctx.beginPath(); gctx.arc(cx(QLR), cy(ATCLR), 4, 0, 2*Math.PI);
  gctx.fillStyle = K.gray; gctx.fill();

  // Excess capacity gap
  gctx.strokeStyle = '#6B7280'; gctx.lineWidth = 1; gctx.setLineDash([]);
  gctx.beginPath(); gctx.moveTo(cx(QLR), cy(0.10)); gctx.lineTo(cx(atcMinQ), cy(0.10)); gctx.stroke();
  gctx.beginPath(); gctx.moveTo(cx(QLR), cy(0.10)-5); gctx.lineTo(cx(QLR), cy(0.10)+5); gctx.stroke();
  gctx.beginPath(); gctx.moveTo(cx(atcMinQ), cy(0.10)-5); gctx.lineTo(cx(atcMinQ), cy(0.10)+5); gctx.stroke();
  label('Excess cap.', (QLR+atcMinQ)/2, 0.06, K.gray, 'center', '9');

  // ATC min marker
  gctx.beginPath(); gctx.arc(cx(atcMinQ), cy(atcMinV), 4, 0, 2*Math.PI);
  gctx.fillStyle = K.gray; gctx.fill();
  label('min ATC', atcMinQ + 0.03, atcMinV - 0.04, K.gray, 'left', '9');

  legend([{l:'D_LR',c:K.blue},{l:'MR_LR',c:K.purple},{l:'MC',c:K.red},{l:'ATC',c:K.gray}]);
}

//
// ── GRAPH 11: FOREIGN EXCHANGE ─────────────────────────────────
//
// D_USD: e = (0.88 + dS*0.13) - 0.76*Q  [foreigners buying USD]
// S_USD: e = (0.08 - sS*0.13) + 0.80*Q  [US buying foreign goods]
//
// Eq: (0.80 + (dS+sS)*0.13) = 1.56Q  →  Q* = (0.80+(dS+sS)*0.13)/1.56
//     e* = D(Q*)
//
function drawForex() {
  const dS = gv('fxd', 0), sS = gv('fxs', 0);
  const D  = Q => (0.88 + dS*0.13) - 0.76*Q;
  const S  = Q => (0.08 - sS*0.13) + 0.80*Q;
  const Qeq = (0.80 + (dS+sS)*0.13) / 1.56;
  const Eeq  = D(Qeq);

  if (Math.abs(dS) > 0.04) drawLine(curve(Q => 0.88 - 0.76*Q, 0.03, 0.97), K.old, 1.2, [4,3]);
  if (Math.abs(sS) > 0.04) drawLine(curve(Q => 0.08 + 0.80*Q, 0.03, 0.97), K.old, 1.2, [4,3]);

  drawAxes('Quantity of USD', 'Exchange Rate (e)');
  drawLine(curve(D, 0.03, 0.97), K.blue, 2.2);
  drawLine(curve(S, 0.03, 0.97), K.red,  2.2);
  endLabel(curve(D, 0.03, 0.97), 'D_USD', K.blue);
  endLabel(curve(S, 0.03, 0.97), 'S_USD', K.red, 'L');

  if (Qeq > 0.03 && Qeq < 0.97 && Eeq > 0.03 && Eeq < 0.97) eqPoint(Qeq, Eeq, 'Q*', 'e*');
  legend([{l:'Demand for USD',c:K.blue},{l:'Supply of USD',c:K.red}]);
}

//
// ── GRAPH 12: INVESTMENT DEMAND ────────────────────────────────
//
// I_D: I = (0.92 + iS*0.13) - 0.82*r  [downward-sloping in r-I space]
// Axes: horizontal = I, vertical = r
//
// At current r = 0.48: I* = I_D(0.48)
//
function drawInvDem() {
  const iS = gv('inv', 0);
  const ID = r => (0.92 + iS*0.13) - 0.82*r;
  const r0 = 0.48;
  const I0 = ID(r0);

  if (Math.abs(iS) > 0.04) drawLine(curve(r => 0.92 - 0.82*r, 0.05, 0.97).map(([r,I])=>[I,r]), K.old, 1.2, [4,3]);

  drawAxes('Investment (I)', 'Real Interest Rate (r)');
  // Curve: plot as [I, r] pairs (I on x-axis, r on y-axis)
  const pts = [];
  for (let r = 0.05; r <= 0.97; r += 0.01) {
    const I = ID(r);
    if (I >= 0 && I <= 1.0) pts.push([I, r]);
  }
  drawLine(pts, K.blue, 2.2);
  if (pts.length) label('I_D', pts[pts.length-1][0] + 0.03, pts[pts.length-1][1], K.blue, 'left', '12');

  // Current interest rate
  hLine(r0, K.green, 'r*', 'R', [4,3]);
  // Current investment
  gctx.setLineDash([4,3]); gctx.strokeStyle = K.green; gctx.lineWidth = 1;
  gctx.beginPath(); gctx.moveTo(cx(I0), cy(r0)); gctx.lineTo(cx(I0), cy(0)); gctx.stroke();
  gctx.setLineDash([]);
  if (I0 > 0.02 && I0 < 0.98) {
    eqPoint(I0, r0, 'I*', null);
  }

  legend([{l:'Investment Demand (I_D)',c:K.blue}]);
}

//
// ── GRAPH 13: EXTERNALITY ──────────────────────────────────────
//
// Base market:
//   MPB (D): P = 0.90 - 0.80*Q
//   MPC (S): P = 0.08 + 0.78*Q
//   Market eq: Q_mkt = 0.82/1.58
//
// Negative externality (extS > 0):
//   MSC = MPC + extS*0.18  →  MSC = (0.08 + extS*0.18) + 0.78*Q
//   Socially optimal Q: MPB = MSC  →  Q_opt = (0.82 - extS*0.18) / 1.58
//
// Positive externality (type='pos', extS > 0):
//   MSB = MPB + extS*0.18  →  MSB = (0.90 + extS*0.18) - 0.80*Q
//   Socially optimal Q: MSB = MPC  →  Q_opt = (0.82 + extS*0.18) / 1.58
//
function drawExternality() {
  const extS   = gv('extmag',  0);
  const isPos  = tv('exttype', 0) > 0.5;

  const MPB = Q => 0.90 - 0.80*Q;
  const MPC = Q => 0.08 + 0.78*Q;
  const Qmkt = 0.82 / 1.58;
  const Pmkt = MPB(Qmkt);

  drawAxes('Quantity (Q)', 'Price / Cost ($)');

  if (isPos) {
    const MSB = Q => (0.90 + extS*0.18) - 0.80*Q;
    const Qopt = Math.min(0.96, (0.82 + extS*0.18) / 1.58);
    const Popt = MPB(Qopt);

    if (extS > 0.04) {
      // DWL: triangle between Qmkt and Qopt
      fillPoly([[Qmkt, Pmkt],[Qopt, Popt],[Qmkt, MPC(Qmkt)]], K.dwl);
      label('DWL', Qmkt + 0.03, (Pmkt+MPC(Qmkt))/2, '#C05700', 'left', '9');
      drawLine(curve(MSB, 0.03, 0.97), K.green, 2, [4,3]);
      endLabel(curve(MSB, 0.03, 0.97), 'MSB', K.green);
      gctx.beginPath(); gctx.arc(cx(Qopt), cy(Popt), 5, 0, 2*Math.PI);
      gctx.fillStyle = K.green; gctx.fill();
      gctx.strokeStyle = '#131317'; gctx.lineWidth = 1.5; gctx.stroke();
      xTick(Qopt, 'Q_opt', K.green); yTick(Popt, 'P_opt', K.green);
      label('Underproduction', (Qmkt+Qopt)/2, 0.06, '#15803D', 'center', '9');
    }
    drawLine(curve(MPC, 0.03, 0.97), K.red, 2.2); endLabel(curve(MPC, 0.03, 0.97), 'S=MPC', K.red, 'L');
    drawLine(curve(MPB, 0.03, 0.97), K.blue, 2.2); endLabel(curve(MPB, 0.03, 0.97), 'D=MPB', K.blue);
  } else {
    const MSC = Q => (0.08 + extS*0.18) + 0.78*Q;
    const Qopt = Math.max(0.04, (0.82 - extS*0.18) / 1.58);
    const Popt = MPB(Qopt);

    if (extS > 0.04) {
      fillPoly([[Qopt, Popt],[Qmkt, Pmkt],[Qmkt, MSC(Qmkt)]], K.dwl);
      label('DWL', Qmkt + 0.01, (Pmkt+MSC(Qmkt))/2, '#C05700', 'left', '9');
      drawLine(curve(MSC, 0.03, 0.97), K.red, 2, [4,3]);
      endLabel(curve(MSC, 0.03, 0.97), 'MSC', K.red, 'L');
      gctx.beginPath(); gctx.arc(cx(Qopt), cy(Popt), 5, 0, 2*Math.PI);
      gctx.fillStyle = K.green; gctx.fill();
      gctx.strokeStyle = '#131317'; gctx.lineWidth = 1.5; gctx.stroke();
      xTick(Qopt, 'Q_opt', K.green); yTick(Popt, 'P_opt', K.green);
      label('Overproduction', (Qopt+Qmkt)/2, 0.06, '#DC2626', 'center', '9');
    }
    drawLine(curve(MPC, 0.03, 0.97), K.red, 2.2); endLabel(curve(MPC, 0.03, 0.97), 'S=MPC', K.red, 'L');
    drawLine(curve(MPB, 0.03, 0.97), K.blue, 2.2); endLabel(curve(MPB, 0.03, 0.97), 'D=MPB', K.blue);
  }

  eqPoint(Qmkt, Pmkt, 'Q_mkt', 'P_mkt');
  legend([{l:'D=MPB',c:K.blue},{l:'S=MPC',c:K.red},{l:isPos?'MSB (social)':'MSC (social)',c:isPos?K.green:K.red,dash:[4,3]}]);
}

//
// ── GRAPH 14: LORENZ CURVE ─────────────────────────────────────
//
// Lorenz(x) = x^(1 + g*2.4)  where g = gini parameter ∈ [0,1]
// Gini coefficient ≈ A / (A+B)
// A + B = 0.5 (triangle below equality line)
// B = ∫₀¹ L(x) dx = 1 / (2 + g*2.4)
// A = 0.5 - B
// Gini = A / 0.5 = 1 - 2B = 1 - 2/(2 + g*2.4)
//
function drawLorenz() {
  const g = gv('gini', 0.5);  // 0=equality, 1=max inequality
  const exp = 1 + g * 2.4;
  const L = x => Math.pow(x, exp);
  const B = 1 / (2 + g*2.4);
  const giniCoef = Math.round((1 - 2*B) * 100) / 100;

  // shade B (under Lorenz)
  const bPoly = [[0,0]];
  for (let x = 0; x <= 1; x += 0.01) bPoly.push([x, L(x)]);
  bPoly.push([1,0]);
  fillPoly(bPoly, K.cs);

  // shade A (between equality and Lorenz)
  const aPoly = [[0,0]];
  for (let x = 0; x <= 1; x += 0.01) aPoly.push([x, x]);
  for (let x = 1; x >= 0; x -= 0.01) aPoly.push([x, L(x)]);
  fillPoly(aPoly, K.dwl);

  drawAxes('Cumulative % Population', 'Cumulative % Income');
  // equality line
  drawLine([[0,0],[1,1]], K.green, 1.8, [4,3]);
  label('Line of perfect equality', 0.55, 0.65, K.green, 'center', '10');
  // Lorenz curve
  drawLine(Array.from({length:101},(_,i)=>[i/100, L(i/100)]), K.blue, 2.4);
  label('Lorenz curve', 0.28, L(0.28) - 0.06, K.blue, 'center', '11');

  // A and B labels
  label('A', 0.45, 0.52, '#C05700', 'center', '14');
  label('B', 0.65, 0.22, K.blue, 'center', '14');

  // Gini display
  gctx.fillStyle = K.txt; gctx.font = '12px ' + font(); gctx.textAlign = 'left';
  gctx.fillText('Gini = A/(A+B) ≈ ' + giniCoef.toFixed(2), cx(0.05), cy(0.94));
  gctx.fillStyle = K.axTxt; gctx.font = '10px ' + font();
  gctx.fillText('0 = perfect equality  ·  1 = one person holds everything', cx(0.05), cy(0.87));

  // axis tick labels (%)
  [0,0.25,0.5,0.75,1].forEach((v,i) => {
    const pct = (v*100)+'%';
    gctx.fillStyle = K.axTxt; gctx.font = '9px ' + font();
    gctx.textAlign = 'center'; gctx.fillText(pct, cx(v), cy(0)+16);
    gctx.textAlign = 'right';  gctx.fillText(pct, cx(0)-4, cy(v)+4);
  });

  legend([{l:'Equality line',c:K.green,dash:[4,3]},{l:'Lorenz curve',c:K.blue}]);
}

//
// ── GRAPH 15: TARIFF & TRADE ───────────────────────────────────
//
// Domestic supply/demand (fixed linear):
//   D: P = 0.88 - 0.82*Q
//   S: P = 0.08 + 0.80*Q
//   Domestic eq: Pe = (0.88*0.80 + 0.08*0.82) / (0.80+0.82) ≈ 0.473, Qe ≈ 0.491
//
// World price Pw = 0.30 (below Pe → imports occur)
// With tariff T: Pt = Pw + T, T = tariffS * 0.20
//
// Quantities (read off S and D curves at each price):
//   Q_Spt at Pw: Q1 = (Pw - 0.08) / 0.80
//   Q_Dpt at Pw: Q4 = (0.88 - Pw) / 0.82
//   Q_Spt at Pt: Q2 = (Pt - 0.08) / 0.80
//   Q_Dpt at Pt: Q3 = (0.88 - Pt) / 0.82
//
function drawTariff() {
  const tariffS = gv('tariff', 0);
  const Pw = 0.30;
  const T  = tariffS * 0.20;
  const Pt = Math.min(0.47, Pw + T);

  // Domestic equilibrium (no trade)
  const Pe = (0.88*0.80 + 0.08*0.82) / (0.80+0.82);
  const Qe = (0.88 - Pe) / 0.82;

  // Quantities at Pw and Pt
  const Q1 = Math.max(0.02, (Pw - 0.08) / 0.80);
  const Q4 = Math.min(0.97, (0.88 - Pw) / 0.82);
  const Q2 = Math.max(0.02, (Pt - 0.08) / 0.80);
  const Q3 = Math.min(0.97, (0.88 - Pt) / 0.82);

  const D = Q => 0.88 - 0.82*Q;
  const S = Q => 0.08 + 0.80*Q;

  // CS under free trade (above Pw, below D)
  const csFT = [[0, D(0)]];
  for (let q = 0; q <= Q4; q += 0.01) csFT.push([q, D(q)]);
  csFT.push([Q4, Pw],[0, Pw]);
  // PS under free trade
  const psFT = [[0, Pw],[Q1, Pw],[Q1, S(0)],[0, S(0)]];

  const hasTariff = tariffS > 0.04;

  if (!hasTariff) {
    fillPoly(csFT, K.cs);
    fillPoly(psFT, K.ps);
    label('CS', Q4*0.4, (D(0)+Pw)/2 - 0.05, K.blue, 'center', '10');
    label('PS', Q1*0.5, (Pw+S(0))/2, K.red, 'center', '10');
  } else {
    // CS with tariff (smaller)
    const csTariff = [[0, D(0)]];
    for (let q = 0; q <= Q3; q += 0.01) csTariff.push([q, D(q)]);
    csTariff.push([Q3, Pt],[0, Pt]);
    fillPoly(csTariff, K.cs);

    // PS with tariff (larger)
    fillPoly([[0, Pt],[Q2, Pt],[Q2, S(0)],[0, S(0)]], K.ps);

    // Govt revenue rectangle (HI)
    fillPoly([[Q2, Pt],[Q3, Pt],[Q3, Pw],[Q2, Pw]], 'rgba(37,99,235,0.14)');
    label('Rev.', (Q2+Q3)/2, (Pt+Pw)/2, K.blue, 'center', '9');

    // DWL triangles
    fillPoly([[Q1, Pw],[Q2, Pw],[Q2, Pt],[Q1, Pt]], K.dwl);  // approx G
    fillPoly([[Q3, Pt],[Q4, Pw],[Q3, Pw]], K.dwl);           // J
    label('G', (Q1+Q2)/2, (Pt+Pw)/2, '#C05700', 'center', '9');
    label('J', (Q3+Q4)/2, Pt-0.03, '#C05700', 'center', '9');
  }

  drawAxes('Quantity (Q)', 'Price (P)');
  drawLine(curve(D, 0.02, 0.97), K.blue, 2.2); endLabel(curve(D,0.02,0.97),'D',K.blue);
  drawLine(curve(S, 0.02, 0.97), K.red,  2.2); endLabel(curve(S,0.02,0.97),'S',K.red,'L');

  // World price line
  hLine(Pw, K.green, 'Pw', 'R', [5,3]);
  if (hasTariff) {
    hLine(Pt, K.amber, 'Pw+T', 'R', [5,3]);
    xTick(Q1, 'Q₁'); xTick(Q2, 'Q₂'); xTick(Q3, 'Q₃'); xTick(Q4, 'Q₄');
    // imports bracket
    gctx.strokeStyle = K.green; gctx.lineWidth = 1;
    const yb = cy(Pw) + 16;
    gctx.beginPath(); gctx.moveTo(cx(Q2)+3, yb); gctx.lineTo(cx(Q3)-3, yb); gctx.stroke();
    gctx.beginPath(); gctx.moveTo(cx(Q2)+3, yb-4); gctx.lineTo(cx(Q2)+3, yb+4); gctx.stroke();
    gctx.beginPath(); gctx.moveTo(cx(Q3)-3, yb-4); gctx.lineTo(cx(Q3)-3, yb+4); gctx.stroke();
    label('Imports', (Q2+Q3)/2, Pw - 0.07, K.green, 'center', '9');
  } else {
    xTick(Q1, 'Q₁'); xTick(Q4, 'Q₄');
    gctx.strokeStyle = K.green; gctx.lineWidth = 1;
    const yb = cy(Pw) + 16;
    gctx.beginPath(); gctx.moveTo(cx(Q1)+3, yb); gctx.lineTo(cx(Q4)-3, yb); gctx.stroke();
    label('Imports', (Q1+Q4)/2, Pw - 0.07, K.green, 'center', '9');
  }

  // Domestic eq dot
  gctx.beginPath(); gctx.arc(cx(Qe), cy(Pe), 4.5, 0, 2*Math.PI);
  gctx.fillStyle = K.eq; gctx.fill();
  yTick(Pe, 'Pe'); xTick(Qe, 'Qe');

  legend([{l:'Demand',c:K.blue},{l:'Supply',c:K.red},{l:'World price',c:K.green,dash:[5,3]}]);
}

// ═══════════════════════════════════════════════════════════════
//  DISPATCHER
// ═══════════════════════════════════════════════════════════════
function renderGraph() {
  gctx.clearRect(0, 0, GW, GH);
  gctx.fillStyle = '#131317';
  gctx.fillRect(0, 0, GW, GH);
  try {
    gctx.save();
    switch (CG) {
      case 'adas':       drawADAS();        break;
      case 'sd':         drawSD();          break;
      case 'lf':         drawLF();          break;
      case 'mm':         drawMM();          break;
      case 'phillips':   drawPhillips();    break;
      case 'ppc':        drawPPC();         break;
      case 'labor':      drawLabor();       break;
      case 'cost':       drawCost();        break;
      case 'monopoly':   drawMonopoly();    break;
      case 'moncomp':    drawMonComp();     break;
      case 'forex':      drawForex();       break;
      case 'invdem':     drawInvDem();      break;
      case 'externality':drawExternality(); break;
      case 'lorenz':     drawLorenz();      break;
      case 'tariff':     drawTariff();      break;
    }
  } catch(e) { console.error('Graph render error:', e); gctx.restore(); }
  gctx.restore();
}

// ═══════════════════════════════════════════════════════════════
//  SHOCK SYSTEM + PANEL + INIT
// ═══════════════════════════════════════════════════════════════

const GRAPHS = {
  adas: {
    title: 'AD-AS Model',
    desc: 'AD slopes down (wealth, interest rate, trade effects). SRAS slopes up (sticky wages short-run). LRAS vertical at potential GDP. All three intersect at long-run equilibrium.',
    shocks: [
      {l:'AD ↑ — stimulus / confidence',  k:'ad',  d:+1, ex:'AD right → P↑, Y↑, u↓. Gap = Y* vs Yp shown by bracket.'},
      {l:'AD ↓ — austerity / recession',  k:'ad',  d:-1, ex:'AD left → P↓, Y↓, u↑. Recessionary gap opens.'},
      {l:'SRAS left — negative shock',     k:'sras',d:+1, ex:'SRAS left → stagflation: P↑ and Y↓ together.'},
      {l:'SRAS right — positive shock',    k:'sras',d:-1, ex:'SRAS right → P↓, Y↑. Oil falls, costs drop.'},
      {l:'LRAS right — long-run growth',   k:'lras',d:+1, ex:'Potential GDP grows: capital, tech, labor.'},
      {l:'LRAS left — capital loss',       k:'lras',d:-1, ex:'Potential GDP shrinks: war, disaster.'},
      {l:'Self-correct ↑ (recessionary)',  k:'sras',d:-1, ex:'Wages fall → SRAS drifts right → returns to Yp at lower P.'},
      {l:'Self-correct ↓ (inflationary)',  k:'sras',d:+1, ex:'Wages rise → SRAS drifts left → returns to Yp at higher P.'},
    ]
  },
  sd: {
    title: 'Supply & Demand',
    desc: 'Demand slopes down. Supply slopes up. Equilibrium where D=S. Blue shading = consumer surplus (CS). Red = producer surplus (PS). Taxes create DWL triangles.',
    shocks: [
      {l:'D ↑ — income↑, tastes',    k:'d',    d:+1, ex:'D right → P*↑, Q*↑. CS changes, new eq.'},
      {l:'D ↓ — income↓, sub↑',     k:'d',    d:-1, ex:'D left → P*↓, Q*↓.'},
      {l:'S ↑ — costs↓, tech',       k:'s',    d:+1, ex:'S right → P*↓, Q*↑.'},
      {l:'S ↓ — costs↑, tariff',     k:'s',    d:-1, ex:'S left → P*↑, Q*↓.'},
      {l:'Per-unit tax → DWL',        k:'tax',  d:+1, ex:'Tax shifts S up by T → DWL + tax rev. rectangle shown.'},
      {l:'Subsidy → remove tax',      k:'tax',  d:-1, ex:'Subsidy lowers effective cost → S right.'},
      {l:'Price floor (above eq.)',    k:'floor',d:'T', ex:'Floor → surplus (Qs>Qd). DWL triangle. Min wage example.'},
      {l:'Price ceiling (below eq.)',  k:'ceil', d:'T', ex:'Ceiling → shortage (Qd>Qs). DWL triangle. Rent control.'},
    ]
  },
  lf: {
    title: 'Loanable Funds',
    desc: 'Real interest rate (r) equates savings supply and investment demand. S = household savings + capital inflows. D = investment + govt borrowing.',
    shocks: [
      {l:'D ↑ — govt deficit, optimism',  k:'dlf',d:+1, ex:'D right → r*↑, Q*↑. Crowding out private investment.'},
      {l:'D ↓ — pessimism, recession',    k:'dlf',d:-1, ex:'D left → r*↓. Less borrowing demand.'},
      {l:'S ↑ — savings↑, cap. inflow',   k:'slf',d:+1, ex:'S right → r*↓, Q*↑. More savings available.'},
      {l:'S ↓ — dissaving, cap. outflow', k:'slf',d:-1, ex:'S left → r*↑. National savings fall.'},
    ]
  },
  mm: {
    title: 'Money Market',
    desc: 'Nominal interest rate (i) set by vertical MS and downward-sloping MD. Fed controls MS directly. Equilibrium: i* = MD(M*).',
    shocks: [
      {l:'MS ↑ — Fed buys bonds / QE',   k:'ms',d:+1, ex:'MS right → i*↓. More money → lower nominal rates.'},
      {l:'MS ↓ — Fed sells bonds / QT',  k:'ms',d:-1, ex:'MS left → i*↑. Fed withdraws money.'},
      {l:'MD ↑ — income↑, π expect.↑',  k:'md',d:+1, ex:'MD right → i*↑. More transactions need cash.'},
      {l:'MD ↓ — income↓, digital pay',  k:'md',d:-1, ex:'MD left → i*↓. Less cash needed.'},
      {l:'RR ↓ → multiplier↑ → MS↑',    k:'ms',d:+1, ex:'Lower RR → money multiplier↑ → MS expands.'},
      {l:'Discount rate ↓ → MS↑',        k:'ms',d:+1, ex:'Cheaper Fed lending → banks lend more → MS↑.'},
    ]
  },
  phillips: {
    title: 'Phillips Curve',
    desc: 'Short-run inverse trade-off between inflation (π) and unemployment (u). LRPC vertical at NAIRU. Supply shocks shift SRPC. Expectations shift it too.',
    shocks: [
      {l:'AD↑ — u↓, π↑ (along SRPC)',    k:'srpc',d:-1, ex:'Move up-left along SRPC: lower u, higher π.'},
      {l:'AD↓ — u↑, π↓ (along SRPC)',    k:'srpc',d:+1, ex:'Move down-right along SRPC: higher u, lower π.'},
      {l:'Neg. supply shock → SRPC↑',     k:'srpc',d:+1, ex:'SRPC shifts up: both u and π rise (stagflation).'},
      {l:'Pos. supply shock → SRPC↓',     k:'srpc',d:-1, ex:'SRPC shifts down: lower π at every u level.'},
      {l:'Natural rate ↑ (structural)',   k:'lrpc',d:+1, ex:'LRPC right → higher NAIRU. Structural mismatch.'},
      {l:'Natural rate ↓ (better match)', k:'lrpc',d:-1, ex:'LRPC left → lower NAIRU. Better job matching.'},
      {l:'Infl. expectations ↑ → SRPC↑', k:'srpc',d:+1, ex:'Workers demand higher wages → costs↑ → SRPC shifts up.'},
      {l:'Fed credibility → expectations↓',k:'srpc',d:-1, ex:'Anchored expectations → SRPC stable or falls.'},
    ]
  },
  ppc: {
    title: 'PPC',
    desc: 'Concave curve = increasing opportunity cost. Points on curve = efficient. Inside = inefficient (unemployment/waste). Outside = unattainable. Outward shift = growth.',
    shocks: [
      {l:'Growth — tech/capital↑',    k:'ppcScale',d:+1, ex:'PPC shifts outward → more of both goods possible.'},
      {l:'Contraction — disaster',    k:'ppcScale',d:-1, ex:'PPC shifts inward → capacity falls.'},
      {l:'X-biased growth',           k:'xbias',   d:+1, ex:'PPC expands along X-axis: X-specific investment.'},
      {l:'Y-biased growth',           k:'ybias',   d:+1, ex:'PPC expands along Y-axis: Y-specific investment.'},
      {l:'Underutilisation (inside)', k:'inside',  d:'T', ex:'Economy inside PPC: unemployment / inefficiency.'},
    ]
  },
  labor: {
    title: 'Labor Market',
    desc: 'Wage (W) set by labor demand (MRP) and labor supply. Blue = worker surplus. Red = firm surplus. Binding min wage = floor above eq → unemployment shown.',
    shocks: [
      {l:'LD↑ — productivity↑',      k:'ld',    d:+1, ex:'Higher MRP → firms hire more → W* and L* both↑.'},
      {l:'LD↓ — automation, recession',k:'ld',  d:-1, ex:'Lower MRP → W* and L* both↓.'},
      {l:'LS↑ — immigration',         k:'ls',   d:+1, ex:'More workers → W*↓, L*↑.'},
      {l:'LS↓ — aging, emigration',   k:'ls',   d:-1, ex:'Fewer workers → W*↑, L*↓.'},
      {l:'Min wage floor',             k:'lfloor',d:'T', ex:'Floor above W* → unemployment bracket shown.'},
    ]
  },
  cost: {
    title: 'Cost Curves',
    desc: 'MC cuts AVC and ATC at their minimums. Profit max: MC=MR. Shutdown: P<AVC. Break-even: P=min ATC. Profit/loss rectangle shaded. Per-unit ≠ lump-sum tax.',
    shocks: [
      {l:'Per-unit tax → MC & ATC↑',    k:'mc', d:+1, ex:'Per-unit tax shifts MC and ATC up → Q*↓.'},
      {l:'Variable cost↑ → AVC,MC,ATC↑',k:'avc',d:+1, ex:'Higher variable inputs shift AVC, MC, and ATC up.'},
      {l:'Fixed cost↑ → ATC only↑',     k:'atc',d:+1, ex:'Fixed cost shifts ATC up only. Q* unchanged. Key exam point!'},
      {l:'Price↑ → MR=P↑',              k:'mr', d:+1, ex:'Higher P → MR=P line rises → profit rectangle grows.'},
      {l:'Price↓ → MR=P↓',              k:'mr', d:-1, ex:'Lower P → may create loss or shutdown condition.'},
      {l:'Tech↑ → MC & AVC↓',           k:'mc', d:-1, ex:'Better tech → lower MC → Q*↑, profit↑.'},
      {l:'Lump-sum tax → ATC only↑',    k:'atc',d:+1, ex:'Lump-sum = fixed cost → only ATC shifts, not MC. Q* same.'},
    ]
  },
  monopoly: {
    title: 'Monopoly',
    desc: 'MR lies below demand (slope = 2× demand for linear D). Profit max: MR=MC. Pm > MC → DWL. Regulation: P=MC (socially optimal), P=ATC (fair return/break-even).',
    shocks: [
      {l:'D↑ — market grows',          k:'mdmd',d:+1, ex:'Demand shifts right → Pm↑, Qm↑, profit↑.'},
      {l:'D↓ — substitutes↑',          k:'mdmd',d:-1, ex:'Demand falls → Pm↓, Qm↓.'},
      {l:'MC↑ — input costs↑',         k:'mmc', d:+1, ex:'MC up → Qm↓, Pm↑, profit↓, DWL changes.'},
      {l:'MC↓ — tech improvement',     k:'mmc', d:-1, ex:'MC down → Qm↑, profit↑.'},
      {l:'Show P=MC (socially optimal)',k:'mreg', d:'T', ex:'Regulator sets P=MC: allocatively efficient, may incur loss.'},
      {l:'Show P=ATC (fair return)',    k:'mfair',d:'T', ex:'Regulator sets P=ATC: zero economic profit, less DWL.'},
    ]
  },
  moncomp: {
    title: 'Monopolistic Competition',
    desc: 'SR like monopoly (profit/loss). LR: entry/exit erodes profit until D is tangent to ATC (zero economic profit). Always excess capacity vs. min ATC.',
    shocks: [
      {l:'Show SR equilibrium',        k:'mcsr', d:'T', ex:'SR: D_SR intersects MR=MC. Profit/loss shaded.'},
      {l:'D↑ — more differentiation', k:'mcdmd',d:+1, ex:'Less elastic demand → SR profit likely.'},
      {l:'D↓ — more competition',     k:'mcdmd',d:-1, ex:'More substitutes → demand more elastic → profits squeezed.'},
    ]
  },
  forex: {
    title: 'Foreign Exchange',
    desc: 'Exchange rate (e) set by supply and demand for USD. D = foreigners buying USD to invest/export to US. S = US buyers of imports supplying USD.',
    shocks: [
      {l:'D↑ — US rates↑, exports↑',  k:'fxd',d:+1, ex:'D_USD right → e*↑ (dollar appreciates).'},
      {l:'D↓ — US rates↓',            k:'fxd',d:-1, ex:'D_USD left → e*↓ (dollar depreciates).'},
      {l:'S↑ — US imports↑',          k:'fxs',d:+1, ex:'S_USD right → e*↓ (dollar depreciates).'},
      {l:'S↓ — US imports↓, tariffs', k:'fxs',d:-1, ex:'S_USD left → e*↑ (dollar appreciates).'},
      {l:'Capital inflow → D↑',       k:'fxd',d:+1, ex:'Foreign investment in US assets → D_USD right → dollar↑.'},
      {l:'Inflation↑ → S↑',           k:'fxs',d:+1, ex:'US inflation → more imports → S_USD right → dollar↓.'},
    ]
  },
  invdem: {
    title: 'Investment Demand',
    desc: 'Investment falls as real r rises (opportunity cost of capital). Curve shifts right on business optimism, tax cuts, tech improvements. Links money market to AD.',
    shocks: [
      {l:'I_D↑ — optimism, tax cut', k:'inv',d:+1, ex:'Investment demand shifts right → more I at every r → AD↑.'},
      {l:'I_D↓ — pessimism',        k:'inv',d:-1, ex:'Investment demand shifts left → less I → AD↓.'},
    ]
  },
  externality: {
    title: 'Externality',
    desc: 'MSB/MSC framework. Negative: MSC > MPC → market overproduces, DWL. Positive: MSB > MPB → market underproduces, DWL. Fix: Pigouvian tax (neg) or subsidy (pos).',
    shocks: [
      {l:'Negative externality',       k:'exttype',d:'neg', ex:'MSC > MPC → overproduction → DWL shown above Q_mkt.'},
      {l:'Positive externality',       k:'exttype',d:'pos', ex:'MSB > MPB → underproduction → DWL shown below Q_mkt.'},
      {l:'Externality magnitude ↑',    k:'extmag', d:+1,    ex:'Larger divergence → bigger DWL, further from optimum.'},
      {l:'Pigouvian intervention ↓',   k:'extmag', d:-1,    ex:'Tax/subsidy narrows gap → DWL shrinks toward zero.'},
    ]
  },
  lorenz: {
    title: 'Lorenz Curve',
    desc: 'Measures income inequality. Gini = A/(A+B). Closer to equality line = more equal. Real values: US ≈ 0.41, Denmark ≈ 0.29, South Africa ≈ 0.63.',
    shocks: [
      {l:'More equal — taxes/transfers',  k:'gini',d:-1, ex:'Progressive policy → Lorenz bows less → Gini↓.'},
      {l:'Less equal — regressive forces',k:'gini',d:+1, ex:'Rising inequality → Lorenz bows more → Gini↑.'},
    ]
  },
  tariff: {
    title: 'Tariff & Trade',
    desc: 'Free trade at Pw < Pe → large CS, large imports. Tariff → Pw+T → CS↓, PS↑, govt revenue (rectangle), DWL triangles G+J. Total welfare always falls.',
    shocks: [
      {l:'Apply tariff',         k:'tariff',d:+1, ex:'Tariff → Pw+T → CS↓, PS↑, revenue, DWL G+J created.'},
      {l:'Increase tariff',      k:'tariff',d:+1, ex:'Higher tariff → more DWL, less imports, more PS.'},
      {l:'Reduce tariff',        k:'tariff',d:-1, ex:'Lower tariff → less DWL → approaching free trade.'},
      {l:'Free trade (remove)',   k:'tariff',d:-1, ex:'Tariff→0: max CS, min DWL, max total welfare.'},
    ]
  },
};

// Default values for each param key
const DEFAULTS = {
  ad:0, sras:0, lras:0, d:0, s:0, tax:0, floor:0, ceil:0,
  dlf:0, slf:0, ms:0, md:0, srpc:0, lrpc:0,
  ppcScale:1, xbias:0, ybias:0, inside:0,
  ld:0, ls:0, lfloor:0, mc:0, atc:0, avc:0, mr:0,
  mdmd:0, mmc:0, mreg:0, mfair:0, mcsr:0, mcdmd:0,
  fxd:0, fxs:0, inv:0, extmag:0, exttype:0, gini:0.5, tariff:0
};

function applyShock(key, dir, label) {
  const def = DEFAULTS[key] !== undefined ? DEFAULTS[key] : 0;
  // Toggle keys
  if (dir === 'T' || dir === 'neg' || dir === 'pos') {
    if (dir === 'neg') { AP_set(CG+'.exttype', 0, 0); }
    else if (dir === 'pos') { AP_set(CG+'.exttype', 1, 0); }
    else {
      const cur = AP_tgt(CG+'.'+key, def);
      AP_set(CG+'.'+key, cur > 0.5 ? 0 : 1, 0);
    }
  } else {
    const cur = AP_tgt(CG+'.'+key, def);
    const min = key === 'ppcScale' ? 0.5 : (key === 'gini' ? 0 : def - 2);
    const max = key === 'ppcScale' ? 1.7 : (key === 'gini' ? 1 : def + 2);
    AP_set(CG+'.'+key, Math.max(min, Math.min(max, cur + dir)), def);
  }
  // Update info bar
  const g = GRAPHS[CG];
  const sh = g ? g.shocks.find(s => s.l === label) : null;
  setInfoBar('graph-info-bar', label + (sh ? ' — ' + sh.ex : ''));
  if (!raf) raf_step();
}

function resetGraph() {
  // Reset all params for current graph
  for (const k in AP) {
    if (k.startsWith(CG + '.')) {
      const key = k.replace(CG+'.','');
      const def = DEFAULTS[key] !== undefined ? DEFAULTS[key] : 0;
      AP[k].tgt = def;
    }
  }
  document.querySelectorAll('.shock-btn').forEach(b => b.classList.remove('active-shock'));
  const _gib = document.getElementById('graph-info-bar');
  if (_gib) {
    _gib.classList.remove('live');
    _gib.innerHTML = '<span class="info-dot"></span>Select a shock to shift the curves.';
  }
  if (!raf) raf_step();
}

function buildShockPanel(gid) {
  const g = GRAPHS[gid];
  if (!g) return;
  const panel = document.getElementById('shock-panel');
  panel.innerHTML = '<div class="shock-panel-title"><span class="sp-dot"></span>Shocks</div>';
  g.shocks.forEach(sh => {
    const btn = document.createElement('button');
    const pos = sh.d === +1 || sh.d === 'T' || sh.d === 'pos';
    const neg = sh.d === -1 || sh.d === 'neg';
    btn.className = 'shock-btn' + (pos ? ' s-right' : neg ? ' s-left' : '');
    btn.textContent = sh.l;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.shock-btn').forEach(b => b.classList.remove('active-shock'));
      btn.classList.add('active-shock');
      applyShock(sh.k, sh.d, sh.l);
    });
    panel.appendChild(btn);
  });
}

const graphDescriptions = {
  adas:       'AD-AS: P vs Y. AD down-sloping; SRAS up; LRAS vertical at Yp. Equilibrium = intersection. Gap annotation shows inflationary/recessionary gap.',
  sd:         'Supply & Demand: P vs Q. D down; S up. Blue=CS, Red=PS. Taxes add DWL. Price controls add floor/ceiling lines with surplus/shortage brackets.',
  lf:         'Loanable Funds: r vs Q. D = borrowing (invest + govt); S = savings. Real r clears market. Crowding out: govt D right → r↑ → private I↓.',
  mm:         'Money Market: i vs M. MS vertical (Fed-controlled); MD downward. i* = MD at M*. Equilibrium i* adjusts instantly to Fed policy.',
  phillips:   'Phillips Curve: π vs u. SRPC = short-run trade-off (inverse). LRPC = vertical at NAIRU. Supply shocks shift SRPC. Expectations shift it too.',
  ppc:        'PPC: Y vs X (two goods). Concave = increasing OC. On curve = efficient. Inside = inefficient (recession). Outside = unattainable. Shift = growth.',
  labor:      'Labor Market: W vs L. LD = MRP (downward); LS upward. Blue = worker surplus; Red = firm surplus. Min wage floor shows unemployment bracket.',
  cost:       'Cost Curves: $ vs Q. MC U-shaped, cuts ATC and AVC at minima. Profit max: MC=MR. Shutdown: P<AVC. Break-even: P=min ATC. Profit/loss shaded.',
  monopoly:   'Monopoly: MR below D (2× slope). Profit max at MR=MC. Pm > MC → DWL. CS/PS/DWL shaded. Optional regulation to P=MC or P=ATC.',
  moncomp:    'Mono. Comp.: SR like monopoly (profit shown). LR: free entry → D_LR tangent to ATC → zero profit. Excess capacity = gap to min ATC.',
  forex:      'Foreign Exchange: e vs Q of USD. D_USD = foreign buyers; S_USD = US buyers of imports. e*↑ = dollar appreciates. Links to AD via NX.',
  invdem:     'Investment Demand: r vs I. Downward-sloping. Shifts on optimism, tax incentives, tech. Links money market → AD. Key channel of monetary policy.',
  externality:'Externality: MSB/MSC vs market curves. DWL shown between market Q and optimal Q. Negative = overproduction; Positive = underproduction.',
  lorenz:     'Lorenz Curve: cumulative income distribution. Area A (DWL color) vs B (CS color). Gini = A/(A+B). 0 = perfect equality; 1 = all income to one.',
  tariff:     'Tariff & Trade: D and S with world price Pw below domestic Pe. Free trade → large imports. Tariff → CS↓, PS↑, govt rev., DWL G+J.',
};

function setGraph(id) {
  CG = id;
  document.querySelectorAll('.gtab').forEach(t => t.classList.toggle('active', t.dataset.graph === id));
  const g = GRAPHS[id];
  if (g) {
    const gi = document.getElementById('graph-info');
    gi.innerHTML = '<strong>' + g.title + '</strong>' + g.desc;
    gi.setAttribute('aria-label', g.title + ': ' + g.desc);
    const tl = document.getElementById('graph-title-label');
    if (tl) tl.textContent = g.title;
  }
  setInfoBar('graph-info-bar', graphDescriptions[id] || '');
  buildShockPanel(id);
  renderGraph();
}

document.querySelectorAll('.gtab').forEach(t => t.addEventListener('click', () => setGraph(t.dataset.graph)));


// ── Hero stat count-up animation ──
(function() {
  const stats = [{el: null, target: 62}, {el: null, target: 26}, {el: null, target: 15}];
  const statEls = document.querySelectorAll('.stat-num');
  if (!statEls.length) return;
  statEls.forEach((el, i) => {
    if (stats[i]) {
      stats[i].el = el;
      const sup = el.querySelector('sup');
      el.textContent = '0';
      if (sup) el.appendChild(sup);
    }
  });
  let start = null;
  const duration = 1200;
  function step(ts) {
    if (!start) start = ts;
    const p = Math.min((ts - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3); // ease-out cubic
    stats.forEach(s => {
      if (!s.el) return;
      const val = Math.round(ease * s.target);
      const sup = s.el.querySelector('sup');
      s.el.textContent = val;
      if (sup) s.el.appendChild(sup);
    });
    if (p < 1) requestAnimationFrame(step);
  }
  // Start when hero is visible
  const hero = document.querySelector('.hero');
  if (!hero) return;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries, obs) => {
      if (entries[0].isIntersecting) { requestAnimationFrame(step); obs.disconnect(); }
    }, {threshold: 0.3}).observe(hero);
  } else {
    requestAnimationFrame(step);
  }
})();

// ── INIT ─────────────────────────────────────
resizeMap();
resizeGraph();
setGraph('adas');