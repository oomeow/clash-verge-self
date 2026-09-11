// refer: https://github.com/openacid/low/tree/master/bitmap
pub(crate) struct Bitmap;

// 全局常量
const SELECT_8_LOOKUP: [u8; 256 * 8] = generate_select8_lookup();
const MASK: [u64; 65] = generate_mask();
const RMASK_UPTO: [u64; 64] = generate_rmask_upto();

const fn generate_select8_lookup() -> [u8; 256 * 8] {
    let mut arr = [0u8; 256 * 8];
    let mut i = 0;
    while i < 256 {
        let mut w = i as u8;
        let mut j = 0;
        while j < 8 {
            let x = w.trailing_zeros() as u8;
            if w != 0 {
                w &= w - 1;
            }
            arr[i * 8 + j] = x;
            j += 1;
        }
        i += 1;
    }
    arr
}

const fn generate_mask() -> [u64; 65] {
    let mut arr = [0u64; 65];
    let mut i = 0;
    while i < 65 {
        arr[i] = if i < 64 { (1 << i) - 1 } else { u64::MAX };
        i += 1;
    }
    arr
}

const fn generate_mask_upto() -> [u64; 64] {
    let mut arr = [0u64; 64];
    let mut i = 0;
    while i < 64 {
        let bits = i + 1;
        arr[i] = if bits < 64 { (1 << bits) - 1 } else { u64::MAX };
        i += 1;
    }
    arr
}

const fn generate_rmask_upto() -> [u64; 64] {
    let mut arr = [0u64; 64];
    let mut i = 0;
    while i < 64 {
        arr[i] = !generate_mask_upto()[i];
        i += 1;
    }
    arr
}

impl Bitmap {
    pub fn index_select_32_r64(words: &[u64]) -> (Vec<i32>, Vec<i32>) {
        let l = words.len() << 6;
        let mut sidx = Vec::<i32>::new();

        let mut ith = -1;
        for i in 0..l {
            if (words[i >> 6] & (1 << (i & 63))) != 0 {
                ith += 1;
                if ith & 31 == 0 {
                    sidx.push(i as i32);
                }
            }
        }
        (sidx, Self::index_rank64(words, true))
    }

    /// An optional bool specifies whether to add a last index entry of count of all
    pub fn index_rank64(words: &[u64], trailing: bool) -> Vec<i32> {
        let mut length = words.len();
        if trailing {
            length += 1;
        }
        let mut idx = Vec::<i32>::with_capacity(length);
        let mut n = 0i32;
        for word in words {
            idx.push(n);
            n += word.count_ones() as i32;
        }
        if trailing {
            idx.push(n)
        }
        idx
    }

    pub fn select_32_r64(words: &[u64], select_index: &[i32], rank_index: &[i32], i: i32) -> (i32, i32) {
        let mut a;
        let l = words.len() as i32;

        let mut word_l = select_index[(i >> 5) as usize] >> 6;
        while rank_index[(word_l + 1) as usize] <= i {
            word_l += 1;
        }

        let mut w = words[word_l as usize];
        let mut ww = w;
        let base = word_l << 6;
        let mut find_ith = (i - rank_index[word_l as usize]) as isize;

        let mut offset = 0i32;

        let mut ones = (ww as u32).count_ones() as isize;
        if ones <= find_ith {
            find_ith -= ones;
            offset |= 32;
            ww >>= 32;
        }

        ones = (ww as u16).count_ones() as isize;
        if ones <= find_ith {
            find_ith -= ones;
            offset |= 16;
            ww >>= 16;
        }

        ones = (ww as u8).count_ones() as isize;
        if ones <= find_ith {
            a = SELECT_8_LOOKUP[((ww >> 5) & 0x7f8 | (find_ith - ones) as u64) as usize] as i32 + offset + 8;
        } else {
            a = SELECT_8_LOOKUP[(((ww & 0xff) << 3) | (find_ith) as u64) as usize] as i32 + offset;
        }

        a += base;

        // "& 63" eliminates boundary check
        w &= RMASK_UPTO[(a & 63) as usize];

        if w != 0 {
            return (a, base + w.trailing_zeros() as i32);
        }

        word_l += 1;
        while word_l < l {
            w = words[word_l as usize];
            if w != 0 {
                return (a, (word_l << 6) + w.trailing_zeros() as i32);
            }
            word_l += 1;
        }
        (a, l << 6)
    }

    pub fn rank_64(words: &[u64], r_index: &[i32], i: i32) -> (i32, i32) {
        let word_l = i >> 6;
        let j = (i & 63) as u32;

        let n = r_index[word_l as usize];
        let w = words[word_l as usize];

        let c1 = n + (w & MASK[j as usize]).count_ones() as i32;

        (c1, (w >> (j as usize)) as i32 & 1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn naive_rank(words: &[u64], i: usize) -> usize {
        let full = words
            .iter()
            .take(i / 64)
            .map(|w| w.count_ones() as usize)
            .sum::<usize>();
        let rem = i % 64;
        if rem == 0 {
            full
        } else {
            full + (words[i / 64] & MASK[rem]).count_ones() as usize
        }
    }

    fn naive_select(words: &[u64], ith: usize) -> Option<usize> {
        let mut seen = 0;
        for b in 0..words.len() * 64 {
            if (words[b >> 6] & (1 << (b & 63))) != 0 {
                if seen == ith {
                    return Some(b);
                }
                seen += 1;
            }
        }
        None
    }

    fn lcg(seed: &mut u64) -> u64 {
        *seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        *seed
    }

    #[test]
    fn test_rank_select_match_naive_random() {
        let mut seed = 0x1234_5678_u64;
        let mut words = vec![0u64; 37];
        for w in &mut words {
            *w = lcg(&mut seed);
        }

        let (selects, ranks) = Bitmap::index_select_32_r64(&words);

        let total_bits = words.len() * 64;
        for i in 0..total_bits {
            let (rank, bit) = Bitmap::rank_64(&words, &ranks, i as i32);
            assert_eq!(rank as usize, naive_rank(&words, i), "rank mismatch at {i}");
            let expect_bit = (words[i >> 6] >> (i & 63)) & 1;
            assert_eq!(bit as u64, expect_bit, "bit mismatch at {i}");
        }

        let total_ones = naive_rank(&words, total_bits);
        for ith in 0..total_ones {
            let (pos, _) = Bitmap::select_32_r64(&words, &selects, &ranks, ith as i32);
            assert_eq!(
                pos as usize,
                naive_select(&words, ith).unwrap(),
                "select mismatch for ith {ith}"
            );
        }
    }

    #[test]
    fn test_rank_select_edge_cases() {
        // 全 0
        let words = vec![0u64; 3];
        let (selects, ranks) = Bitmap::index_select_32_r64(&words);
        assert!(selects.is_empty());
        for i in 0..words.len() * 64 {
            let (rank, bit) = Bitmap::rank_64(&words, &ranks, i as i32);
            assert_eq!(rank, 0);
            assert_eq!(bit, 0);
        }

        // 全 1
        let words = vec![u64::MAX; 2];
        let (selects, ranks) = Bitmap::index_select_32_r64(&words);
        for ith in 0..128 {
            let (pos, _) = Bitmap::select_32_r64(&words, &selects, &ranks, ith as i32);
            assert_eq!(pos as usize, ith, "all-ones select mismatch at {ith}");
        }
        for i in 0..128 {
            let (rank, bit) = Bitmap::rank_64(&words, &ranks, i as i32);
            assert_eq!(rank as usize, i, "all-ones rank mismatch at {i}");
            assert_eq!(bit, 1);
        }

        // 单个 1 位在边界处（第 63 位）
        let words = vec![1u64 << 63, 0];
        let (selects, ranks) = Bitmap::index_select_32_r64(&words);
        let (pos, _) = Bitmap::select_32_r64(&words, &selects, &ranks, 0);
        assert_eq!(pos, 63);
    }
}
