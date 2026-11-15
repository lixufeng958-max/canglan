# 余烬·尸潮：把素材包里的角色切成骨架部件（头/身体/左臂/右臂/左腿/右腿），输出到 yujin/spr/ 和 yujin/sprmeta.js
# 用法：在仓库根目录 python3 tests/yj-cut.py
# 多边形和关节坐标都是原图像素。部件按 PRI 的先后归属像素；四肢会往身体里多带一圈（羽化），身体在被切走的地方补色，摆动时不露缝。
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, json, os
OUT='yujin/spr/'; os.makedirs(OUT, exist_ok=True); TARGET=340
C = {
 'hero': dict(f='hero', H=64, polys=dict(
    head=[(230,0),(570,0),(585,230),(525,345),(400,365),(300,335),(238,230)],
    leg_l=[(120,720),(420,735),(405,900),(335,1050),(205,1150),(165,1335),(0,1345),(15,1100),(95,900)],
    leg_r=[(395,770),(650,745),(690,950),(670,1150),(730,1489),(495,1489),(478,1200),(428,950)]),
    piv=dict(head=(410,335), leg_l=(300,770), leg_r=(545,795)), ax=400),
 'walker': dict(f='zombie_ordinary', H=70, polys=dict(
    head=[(160,0),(660,0),(685,330),(605,520),(520,592),(400,592),(285,505),(170,385)],
    arm_l=[(105,405),(250,400),(300,520),(312,700),(272,860),(242,1000),(300,1120),(392,1200),(382,1335),(300,1425),(200,1505),(55,1485),(0,1300),(0,900),(38,650)],
    arm_r=[(820,470),(985,480),(1095,650),(1105,900),(1120,1150),(1120,1305),(1040,1365),(900,1345),(788,1205),(768,1090),(860,1010),(930,900),(900,760),(850,620)],
    leg_l=[(300,1020),(520,1020),(540,1250),(500,1420),(482,1525),(358,1525),(348,1380),(308,1250)],
    leg_r=[(500,1020),(785,1020),(785,1300),(742,1500),(722,1750),(685,1960),(478,1960),(518,1700),(558,1450),(520,1280)]),
    piv=dict(head=(430,520), arm_l=(215,470), arm_r=(905,555), leg_l=(410,1060), leg_r=(640,1060)), ax=560),
 'spitter': dict(f='zombie_spitter', H=70, polys=dict(
    head=[(0,0),(525,0),(505,150),(402,262),(332,332),(250,422),(120,442),(0,332)],
    arm_l=[(110,520),(262,540),(252,700),(222,850),(232,1000),(202,1150),(232,1350),(252,1500),(202,1625),(88,1605),(38,1400),(48,1150),(88,950),(68,800),(98,650)],
    leg_l=[(480,1100),(780,1100),(800,1300),(622,1500),(522,1700),(482,1927),(278,1927),(298,1650),(418,1450),(468,1250)],
    leg_r=[(760,1150),(930,1150),(930,1500),(700,1500),(660,1380),(790,1300)]),
    piv=dict(head=(330,335), arm_l=(180,600), leg_l=(640,1120), leg_r=(800,1180)), ax=520),
 'brute': dict(f='zombie_giant', H=106, bg=1, polys=dict(
    head=[(540,280),(822,280),(832,480),(792,622),(640,642),(558,560)],
    arm_l=[(60,560),(330,600),(420,800),(400,1000),(330,1150),(300,1300),(330,1450),(472,1560),(502,1700),(432,1795),(280,1785),(118,1650),(18,1400),(0,1100),(8,800)],
    arm_r=[(960,560),(1120,600),(1120,1100),(1112,1300),(1000,1345),(898,1280),(878,1150),(938,1050),(958,900),(948,750)],
    leg_l=[(330,1380),(620,1380),(620,1650),(540,1850),(522,2105),(258,2105),(268,1850),(328,1650)],
    leg_r=[(600,1380),(900,1380),(922,1600),(942,1835),(618,1835),(638,1600)]),
    piv=dict(head=(690,600), arm_l=(230,760), arm_r=(1020,740), leg_l=(470,1400), leg_r=(760,1400)), ax=600),
 'runner': dict(f='zombie_runner', H=60, polys=dict(
    head=[(230,250),(600,250),(702,450),(692,650),(560,852),(420,852),(300,700),(228,500)],
    arm_l=[(530,720),(560,880),(380,902),(250,882),(200,950),(330,1000),(382,1100),(332,1182),(200,1172),(58,1050),(0,880),(58,760),(250,690),(400,690)],
    arm_r=[(760,330),(800,200),(1000,20),(1150,0),(1477,200),(1477,382),(1350,372),(1300,250),(1150,140),(1000,180),(900,330),(850,420)],
    leg_l=[(500,900),(880,900),(902,1250),(782,1262),(702,1379),(498,1379),(508,1150)],
    leg_r=[(1000,640),(1100,560),(1200,450),(1402,440),(1402,650),(1250,702),(1200,862),(1050,902),(978,800)]),
    piv=dict(head=(600,600), arm_l=(520,790), arm_r=(820,320), leg_l=(680,930), leg_r=(1040,760)), ax=770),
 'bloater': dict(f='zombie_bloater', H=84, belly=(720,880,410,335), polys=dict(
    head=[(400,0),(790,0),(802,300),(762,520),(620,602),(500,562),(408,350)],
    arm_l=[(30,420),(200,440),(250,600),(222,850),(202,1000),(222,1150),(172,1285),(38,1275),(0,1100),(0,600)],
    arm_r=[(1130,380),(1280,420),(1327,600),(1327,922),(1180,922),(1140,800),(1160,650),(1120,520)],
    leg_l=[(200,1080),(520,1120),(520,1300),(482,1550),(238,1550),(258,1350),(188,1250)],
    leg_r=[(740,1150),(1100,1100),(1122,1300),(1082,1422),(758,1402)]),
    piv=dict(head=(600,520), arm_l=(140,520), arm_r=(1220,500), leg_l=(360,1150), leg_r=(920,1150)), ax=663),
}
PRI=['head','arm_l','arm_r','leg_l','leg_r']
def dilate(m, n):  # 布尔掩码膨胀 n 像素
    im=Image.fromarray((m*255).astype(np.uint8)); return np.asarray(im.filter(ImageFilter.MaxFilter(2*n+1)))>127
def inpaint(rgb, known, n):  # 把已知颜色往外抹 n 圈
    rgb=rgb.copy().astype(np.float32); k=known.copy()
    for _ in range(n):
        acc=np.zeros_like(rgb); cnt=np.zeros(k.shape,np.float32)
        for dy,dx in ((0,1),(0,-1),(1,0),(-1,0)):
            sk=np.roll(k,(dy,dx),(0,1)); sr=np.roll(rgb,(dy,dx),(0,1)); acc+=sr*sk[...,None]; cnt+=sk
        new=(~k)&(cnt>0); rgb[new]=acc[new]/cnt[new][:,None]; k|=new
    return rgb.astype(np.uint8), k
meta={}
for key,c in C.items():
    im=Image.open('yujin/'+c['f']+'_full.png').convert('RGBA'); W,H=im.size; k=TARGET/H
    small=im.resize((round(W*k),round(H*k)),Image.LANCZOS); A=np.asarray(small).copy(); h,w=A.shape[:2]
    if c.get('bg'): # 去掉半透明的底色
        a=A[...,3].astype(np.int32); A[...,3]=np.clip((a-190)*4,0,255).astype(np.uint8)
    alpha=A[...,3]>24; owner=np.zeros((h,w),np.int8)  # 0 = 身体
    masks={}
    for p in PRI:
        if p not in c['polys']: continue
        mi=Image.new('L',(w,h),0); ImageDraw.Draw(mi).polygon([(x*k,y*k) for x,y in c['polys'][p]],fill=255); m=(np.asarray(mi)>127)&alpha&(owner==0)
        if c.get('belly') and p.startswith('leg'):
            bx,by,brx,bry=[v*k for v in c['belly']]; yy,xx=np.mgrid[0:h,0:w]; m&=((xx-bx)/brx)**2+((yy-by)/bry)**2>1
        owner[m]=PRI.index(p)+1; masks[p]=m
    torso=alpha&(owner==0); parts={}
    # 身体：四肢/头被切走的边缘补一圈颜色，转动时不露洞
    rgb,known=inpaint(A[...,:3],torso,10); ta=np.where(torso,A[...,3],0).astype(np.uint8); ring=known&~torso&alpha; ta[ring]=(A[...,3][ring]*.9).astype(np.uint8)
    parts['torso']=np.dstack([rgb,ta])
    for p,m in masks.items():
        big=dilate(m,5)&alpha; soft=np.asarray(Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))).astype(np.float32)/255
        pa=np.where(m,A[...,3],(A[...,3]*np.clip(soft*2.2,0,1)*big)).astype(np.uint8); parts[p]=np.dstack([A[...,:3],pa])
    M=dict(w=W,h=H,k=round(k,5),H=c['H'],ax=c['ax'],piv=c['piv'],parts={})
    for p,arr in parts.items():
        ys,xs=np.where(arr[...,3]>8)
        if len(xs)==0: continue
        x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
        Image.fromarray(arr[y0:y1,x0:x1]).save(f'{OUT}{key}_{p}.png',optimize=True); M['parts'][p]=[int(x0),int(y0),int(x1-x0),int(y1-y0)]
    meta[key]=M; print(key,{p:v for p,v in M['parts'].items()})
open('yujin/sprmeta.js','w',encoding='utf8').write('/* 由 tests/yj-cut.py 生成：各角色部件在缩小图里的位置（x,y,w,h）、缩放 k、关节（原图像素） */\nYJ.SPRMETA = '+json.dumps(meta,separators=(',',':'))+';\n')
# 爬行者：两帧 SVG 原样拷进 spr/
for n in ('crawler_a.svg','crawler_b.svg'): open(OUT+n,'wb').write(open('yujin/'+n,'rb').read())
print('total KB', sum(os.path.getsize(OUT+f) for f in os.listdir(OUT))//1024, len(os.listdir(OUT)))
