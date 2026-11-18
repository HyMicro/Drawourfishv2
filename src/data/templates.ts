import type { FishTemplateId } from '../../shared/protocol';

export interface FishTemplate {
  id: FishTemplateId;
  label: string;
  emoji: string;
  /** SVG path in a 1024×1024 design space. Fish faces right. */
  path: string;
  eye: { x: number; y: number; r: number };
  eye2?: { x: number; y: number; r: number };
  /** Tight bounding box used to crop the final WebP texture. */
  box: { x: number; y: number; w: number; h: number };
  accent: string;
  pattern: 'stripes' | 'spots' | 'sweep' | 'plain';
  motion: 'rope' | 'drift';
  /** Relative display size in the aquarium. */
  size: number;
  free?: boolean;
  mouth?: { x: number; y: number; w: number; h: number; kind: 'o' | 'smile' };
}

export const TEMPLATES: FishTemplate[] = [
  {
    id: 'clownfish',
    label: 'Clownfish',
    emoji: '🐠',
    path: `
      M 300 545
      C 300 430 410 345 575 342
      C 715 340 835 405 875 490
      C 895 535 875 580 835 615
      C 760 680 590 705 460 675
      C 360 652 300 610 300 545 Z
      M 325 520
      C 265 490 205 455 150 432
      C 180 492 183 540 145 612
      C 210 597 272 592 330 610 Z
      M 455 370
      C 480 305 545 275 610 290
      C 590 320 578 345 576 375 Z
      M 520 680
      C 535 735 585 765 640 760
      C 615 725 608 698 612 672 Z
    `,
    eye: { x: 762, y: 462, r: 36 },
    box: { x: 120, y: 265, w: 795, h: 515 },
    accent: '#FF8A5B',
    pattern: 'stripes',
    motion: 'rope',
    size: 1,
    mouth: { x: 846, y: 552, w: 34, h: 22, kind: 'smile' },
  },
  {
    id: 'goldfish',
    label: 'Goldfish',
    emoji: '🐟',
    path: `
      M 320 535
      C 320 415 450 330 610 335
      C 755 340 850 420 858 525
      C 866 630 760 700 610 700
      C 450 700 320 655 320 535 Z
      M 340 520
      C 270 470 210 405 130 395
      C 170 465 185 515 150 570
      C 215 565 270 578 335 610
      C 305 580 305 550 340 520 Z
      M 335 600
      C 280 650 230 710 165 735
      C 210 675 218 640 180 605
      C 245 608 295 590 340 570 Z
      M 470 355
      C 500 292 575 268 635 292
      C 610 320 598 345 600 375 Z
    `,
    eye: { x: 750, y: 472, r: 38 },
    box: { x: 110, y: 255, w: 795, h: 555 },
    accent: '#FFB021',
    pattern: 'sweep',
    motion: 'rope',
    size: 1.02,
    mouth: { x: 828, y: 575, w: 40, h: 24, kind: 'o' },
  },
  {
    id: 'puffer',
    label: 'Pufferfish',
    emoji: '🐡',
    path: `
      M 535 270
      A 245 245 0 1 0 535 760
      A 245 245 0 1 0 535 270 Z
      M 465 310 L 490 215 L 530 300 Z
      M 620 335 L 688 262 L 690 350 Z
      M 760 455 L 842 428 L 768 505 Z
      M 690 680 L 758 735 L 644 706 Z
      M 520 745 L 548 815 L 582 738 Z
      M 395 700 L 338 752 L 405 665 Z
      M 315 525
      C 260 490 215 460 165 458
      C 200 505 205 540 170 595
      C 225 580 275 580 320 600 Z
    `,
    eye: { x: 688, y: 452, r: 35 },
    box: { x: 145, y: 190, w: 700, h: 645 },
    accent: '#FFD93D',
    pattern: 'spots',
    motion: 'rope',
    size: 0.92,
    mouth: { x: 758, y: 552, w: 28, h: 32, kind: 'o' },
  },
  {
    id: 'shark',
    label: 'Baby Shark',
    emoji: '🦈',
    path: `
      M 240 520
      C 300 425 440 380 605 382
      C 745 384 835 425 900 478
      C 870 500 866 526 902 548
      C 840 605 720 648 570 648
      C 400 648 285 605 240 520 Z
      M 280 520
      C 210 480 165 430 100 400
      C 145 470 150 520 110 600
      C 175 582 225 585 292 610 Z
      M 470 398
      C 500 330 580 300 640 318
      C 615 350 610 375 625 408 Z
      M 600 585
      C 625 640 675 680 725 692
      C 695 650 690 615 702 585 Z
    `,
    eye: { x: 810, y: 474, r: 24 },
    box: { x: 85, y: 290, w: 835, h: 420 },
    accent: '#7EC8E3',
    pattern: 'sweep',
    motion: 'rope',
    size: 1.14,
    mouth: { x: 862, y: 560, w: 42, h: 20, kind: 'smile' },
  },
  {
    id: 'seahorse',
    label: 'Seahorse',
    emoji: '🪼',
    path: `
      M 610 170
      C 668 162 718 196 733 246
      L 806 258
      L 813 286
      L 742 299
      C 730 336 692 360 648 350
      C 618 343 597 326 584 305
      C 570 350 566 402 590 450
      C 612 495 646 522 642 575
      C 638 632 602 683 548 710
      C 494 737 432 722 403 679
      C 375 638 390 590 432 573
      C 471 557 508 584 505 620
      C 502 649 477 661 457 648
      C 468 640 470 628 461 620
      C 442 604 414 623 411 649
      C 407 680 437 703 471 701
      C 522 698 565 661 575 616
      C 585 567 553 535 532 497
      C 505 448 502 397 521 350
      C 530 327 541 308 553 291
      C 538 260 538 220 560 190
      C 575 173 592 167 610 170 Z
      M 558 370
      C 512 378 480 408 474 448
      C 508 432 540 432 566 446
      Z
    `,
    eye: { x: 676, y: 250, r: 29 },
    box: { x: 365, y: 135, w: 475, h: 620 },
    accent: '#F8A5C2',
    pattern: 'spots',
    motion: 'drift',
    size: 0.9,
    mouth: { x: 796, y: 278, w: 22, h: 12, kind: 'smile' },
  },
  {
    id: 'angelfish',
    label: 'Angelfish',
    emoji: '🐠',
    path: `
      M 355 520
      C 380 425 490 345 635 342
      C 730 340 802 375 850 425
      C 870 447 858 470 838 488
      C 868 548 842 620 780 662
      C 700 716 540 726 435 665
      C 350 616 320 568 355 520 Z
      M 500 368
      C 480 290 520 225 610 205
      C 595 265 615 310 680 345 Z
      M 500 670
      C 520 745 580 795 650 812
      C 620 752 640 715 700 688 Z
      M 355 520
      C 300 480 250 485 200 520
      C 250 535 290 560 315 600
      C 315 560 325 535 360 525 Z
    `,
    eye: { x: 775, y: 448, r: 32 },
    box: { x: 175, y: 180, w: 750, h: 655 },
    accent: '#B79BF5',
    pattern: 'stripes',
    motion: 'rope',
    size: 1.03,
    mouth: { x: 836, y: 528, w: 32, h: 20, kind: 'smile' },
  },
  {
    id: 'manta',
    label: 'Manta Ray',
    emoji: '🐟',
    path: `
      M 360 520
      C 450 400 600 350 740 382
      C 810 398 866 440 890 490
      C 880 510 878 532 888 552
      C 830 615 690 675 545 670
      C 410 665 320 600 300 548
      C 318 538 340 528 360 520 Z
      M 860 470
      C 900 450 930 455 945 475
      C 915 480 895 490 880 505 Z
      M 868 556
      C 908 566 932 584 938 606
      C 908 598 884 594 868 582 Z
      M 330 540
      C 240 568 150 616 78 662
      C 168 600 220 550 250 505
      C 280 510 310 528 336 534 Z
    `,
    eye: { x: 800, y: 468, r: 23 },
    box: { x: 65, y: 350, w: 895, h: 340 },
    accent: '#7F9CF5',
    pattern: 'sweep',
    motion: 'rope',
    size: 1.16,
    mouth: { x: 858, y: 532, w: 30, h: 16, kind: 'smile' },
  },
  {
    id: 'whale',
    label: 'Whale',
    emoji: '🐳',
    path: `
      M 285 520
      C 295 400 430 325 610 328
      C 750 330 852 388 900 462
      C 872 485 868 520 900 548
      C 852 630 710 690 545 690
      C 390 690 275 630 285 520 Z
      M 300 520
      C 230 480 185 430 120 405
      C 165 475 168 525 130 605
      C 195 590 250 588 315 605 Z
      M 570 608
      C 610 660 670 690 725 700
      C 690 662 682 632 695 605 Z
      M 545 345
      C 555 312 590 295 625 300
      C 610 318 602 338 605 360 Z
    `,
    eye: { x: 805, y: 468, r: 26 },
    box: { x: 105, y: 285, w: 815, h: 430 },
    accent: '#66D9E8',
    pattern: 'sweep',
    motion: 'rope',
    size: 1.2,
    mouth: { x: 862, y: 556, w: 44, h: 22, kind: 'smile' },
  },
  {
    id: 'squid',
    label: 'Squid',
    emoji: '🦑',
    path: `
      M 512 92
      C 612 92 700 190 716 314
      C 730 410 704 500 634 544
      C 614 556 606 578 610 608
      C 616 650 602 682 574 686
      C 546 690 530 666 536 642
      C 542 616 526 596 502 594
      C 476 592 458 614 464 642
      C 470 674 450 698 422 690
      C 390 680 378 650 390 614
      C 398 588 384 566 358 558
      C 284 532 248 448 258 350
      C 270 210 388 92 512 92 Z
      M 330 536
      C 286 554 254 596 264 642
      C 272 680 306 698 330 680
      C 350 664 342 636 322 632
      C 306 629 294 644 298 658
      C 278 646 282 606 310 582 Z
      M 694 536
      C 738 554 770 596 760 642
      C 752 680 718 698 694 680
      C 674 664 682 636 702 632
      C 718 629 730 644 726 658
      C 746 646 742 606 714 582 Z
      M 430 590
      C 404 626 384 674 402 714
      C 414 742 446 744 456 720
      C 464 700 446 682 430 692
      C 438 664 458 632 474 610 Z
      M 512 602
      C 492 650 490 708 512 738
      C 528 760 558 744 550 718
      C 544 698 526 698 526 718
      C 518 682 520 642 536 610 Z
      M 594 590
      C 620 626 640 674 622 714
      C 610 742 578 744 568 720
      C 560 700 578 682 594 692
      C 586 664 566 632 550 610 Z
    `,
    eye: { x: 438, y: 468, r: 33 },
    eye2: { x: 586, y: 468, r: 33 },
    box: { x: 150, y: 60, w: 724, h: 730 },
    accent: '#FF857A',
    pattern: 'spots',
    motion: 'drift',
    size: 1.0,
    mouth: { x: 512, y: 548, w: 34, h: 20, kind: 'smile' },
  },
  {
    id: 'betta',
    label: 'Betta',
    emoji: '🐠',
    path: `
      M 320 520
      C 380 440 510 400 650 410
      C 770 418 856 455 900 500
      C 870 520 866 546 898 570
      C 840 638 720 674 586 662
      C 456 650 360 610 320 520 Z
      M 330 520
      C 290 470 240 430 180 410
      C 230 470 245 510 230 550
      C 200 580 165 600 130 630
      C 200 630 250 660 290 690
      C 285 660 295 630 320 610
      C 300 580 300 548 330 520 Z
      M 510 418
      C 520 340 580 280 675 260
      C 650 310 655 345 700 380
      C 660 380 620 400 600 440
      C 575 415 545 408 510 418 Z
      M 620 410
      C 665 345 735 320 790 332
      C 750 372 745 402 778 436
      C 735 420 690 430 660 455 Z
      M 500 650
      C 520 720 590 770 680 770
      C 655 725 660 700 690 675
      C 640 685 600 675 570 645 Z
      M 608 650
      C 628 720 648 780 708 810
      C 688 760 698 725 728 700
      C 688 705 653 685 638 640 Z
    `,
    eye: { x: 800, y: 496, r: 30 },
    box: { x: 120, y: 240, w: 810, h: 585 },
    accent: '#7FB6F4',
    pattern: 'sweep',
    motion: 'rope',
    size: 1.06,
    mouth: { x: 862, y: 548, w: 34, h: 20, kind: 'smile' },
  },
  {
    id: 'koi',
    label: 'Koi',
    emoji: '🐟',
    path: `
      M 340 520
      C 400 450 530 425 680 440
      C 790 450 865 480 905 515
      C 875 535 872 555 900 580
      C 840 640 730 665 600 655
      C 470 645 375 610 340 520 Z
      M 360 520
      C 300 480 240 450 170 430
      C 220 480 245 520 260 560
      C 220 550 180 570 140 600
      C 210 600 260 620 305 650
      C 295 610 310 570 360 545 Z
      M 520 442
      C 540 380 600 340 680 335
      C 655 375 660 405 700 430
      C 650 425 590 435 565 465 Z
      M 520 645
      C 540 705 600 745 670 748
      C 645 712 650 690 680 670
      C 635 678 590 670 560 645 Z
    `,
    eye: { x: 810, y: 500, r: 27 },
    box: { x: 120, y: 320, w: 810, h: 400 },
    accent: '#FFC46B',
    pattern: 'spots',
    motion: 'rope',
    size: 1.1,
    mouth: { x: 865, y: 548, w: 32, h: 18, kind: 'smile' },
  },
  {
    id: 'free',
    label: 'Gambar Bebas',
    emoji: '✏️',
    path: '',
    eye: { x: 512, y: 512, r: 30 },
    box: { x: 0, y: 0, w: 1024, h: 1024 },
    accent: '#FFB6C9',
    pattern: 'sweep',
    motion: 'drift',
    size: 1,
    free: true,
  },
];

export const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((template) => [template.id, template])) as Record<
  FishTemplateId,
  FishTemplate
>;

export function getTemplate(id: FishTemplateId): FishTemplate {
  return TEMPLATE_MAP[id] ?? TEMPLATES[0];
}

export const PALETTE = [
  { name: 'Koral', color: '#FF6B6B' },
  { name: 'Oranye', color: '#FF9F45' },
  { name: 'Lemon', color: '#FFD93D' },
  { name: 'Mint', color: '#5BE7A9' },
  { name: 'Toska', color: '#2EC4B6' },
  { name: 'Langit', color: '#63C7FF' },
  { name: 'Samudra', color: '#3A86FF' },
  { name: 'Lavender', color: '#B79BF5' },
  { name: 'Anggur', color: '#8B5CF6' },
  { name: 'Permen', color: '#FF8FB1' },
  { name: 'Pink', color: '#FFB3D9' },
  { name: 'Krem', color: '#FFF3D6' },
  { name: 'Putih', color: '#FFFFFF' },
  { name: 'Arang', color: '#243447' },
  { name: 'Kayu', color: '#A9744F' },
  { name: 'Lime', color: '#B8E986' },
] as const;

export const STUDIO_SWATCHES = [
  '#FF7DA8',
  '#FFB27D',
  '#FFE66D',
  '#8FE3B0',
  '#72DDE8',
  '#8AB6FF',
  '#C9B1FF',
  '#FFF9F0',
] as const;
